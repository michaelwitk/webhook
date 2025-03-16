const http = require('http')
const crypto = require('crypto')
const assert = require('assert')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const fs = require('fs')

assert(process.env.SECRET, 'required process.env.SECRET')
assert(process.env.PORT, 'required process.env.PORT')

const SECRET = process.env.SECRET
const PORT = process.env.PORT

const git_pull = async (app) => {
    console.log(`pulling ${app}`)
    const { stdout, stderr } = await exec(`cd $HOME/${app} && git pull`)
    console.log({ stdout, stderr })

    const pwd = `${process.env.HOME}/${app}`
    if (fs.existsSync(`${pwd}/package.json`)) {
        console.log('found package.json')

        await exec(`cd ${pwd} && npm i`)

        let package_json
        try {
            package_json = fs.readFileSync(`${pwd}/package.json`)
            package_json = JSON.parse(package_json)
        } catch (error) {
            // console.error(error)
        }

        let build = true
        if (
            package_json &&
            package_json.dependencies &&
            package_json.dependencies.next
        )
            build = false

        if (build) await exec(`cd ${pwd} && npm run build`)
    }
    if (fs.existsSync(`${pwd}/next.config.js`)) {
        console.log('found next.config.js')
        let config = fs.readFileSync(`${pwd}/next.config.js`)

        if (
            !config.includes(`distDir`) ||
            !config.includes(`process.env.BUILD_DIR`)
        )
            throw new Error(
                'next.config.js missing distDir: process.env.BUILD_DIR'
            )

        const tmp = `.next_tmp`
        await exec(`
cd ${pwd} &&
BUILD_DIR=${tmp} npm run build && 
rm -rf .next &&
mv ${tmp} .next 
      `)
    }

    return stdout
}

const pm2_jlist = async () => {
    let { stdout } = await exec(`pm2 jlist`)
    return JSON.parse(stdout)
}
const pm2_reload = async (app = 'all') => {
    console.log(`PM2 reloading ${app}`)

    const { stdout } = await exec(`pm2 reload ${app}`)
    return stdout
}

const verifySignature = (req, body) => {
    const signature = req.headers['x-hub-signature-256']
    if (!signature) return false
    const hmac = crypto.createHmac('sha256', SECRET)
    hmac.update(body, 'utf-8')
    const expectedSignature = `sha256=${hmac.digest('hex')}`
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    )
}

const server = http.createServer(async (original_req, res) => {
    const req = new URL(original_req.url, 'http://localhost:3000')
    if (req.pathname !== '/') {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end()
        return
    }

    if (req.searchParams.get('debug')) {
        let apps = await pm2_jlist()
        apps = apps.map((app) => app.name)
        // always end with self
        apps.sort((a) => (a === 'simple' ? 1 : -1))

        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end(`restarting: ${apps.join(', ')}`)

        for (let index = 0; index < apps.length; index++) {
            try {
                const name = apps[index]
                await git_pull(name)
                await pm2_reload(`${name} --force`)
            } catch (error) {
                console.error(error)
            }
        }

        return
    }

    if (original_req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'text/plain' })
        res.end('Method Not Allowed')
        return
    }

    let body = ''
    original_req.on('data', (chunk) => {
        body += chunk
    })

    original_req.on('end', async () => {
        if (!verifySignature(original_req, body)) {
            res.writeHead(401, { 'Content-Type': 'text/plain' })
            res.end('Invalid signature')
            return
        }
        // console.log(body)

        const payload = JSON.parse(body)
        // console.log('Received GitHub Webhook:')
        // console.log(payload)

        const app = payload.repository.name
        await git_pull(app)

        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end(`restarting ${app}`)

        await pm2_reload(app)
    })
})

server.listen(PORT, async () => {
    console.log(`Listening for GitHub webhooks on port ${PORT}`)
})
