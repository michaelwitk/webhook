sudo apt update
sudo apt install nginx -y

sudo systemctl enable nginx
sudo systemctl start nginx

sudo apt install certbot python3-certbot-nginx -y

# change on cloudflare -> SSL -> Strict
EMAIL=mwit2023@gmail.com
DOMAIN=git.michaelwitk.com

# copy git.michaelwitk.com file to VPS 
sudo ln -s /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

sudo nginx -t
sudo systemctl restart nginx

sudo certbot --nginx --agree-tos --no-eff-email --non-interactive -m $EMAIL -d $DOMAIN
sudo certbot renew --dry-run

sudo crontab -e
0 0,12 * * * certbot renew --quiet

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash
nvm i --lts

npm i -g pm2@5.4

npm i 
npm run build

# cd $HOME
git clone git@github.com:michaelwitk/webhook.git

# nodejs 
NAME=simple
PORT=3000
pm2 start "PORT=$PORT index.js" --log-date-format "YYYY-MM-DD HH:mm:ss" --name $NAME 

# ... or nextjs
NAME=blog
PORT=3001 pm2 start ./node_modules/.bin/next -i 2 --log-date-format "YYYY-MM-DD HH:mm:ss" --name blog -- start

pm2 install pm2-logrotate
pm2 save
pm2 startup

# pm2 logs --lines 50