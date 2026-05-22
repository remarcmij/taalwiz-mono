# Deployment Setup — docs

This site is served as static files by the existing nginx instance on the Raspberry Pi. No new process or systemd service is needed.

## 1. Build the site

On the Pi (or build locally and `rsync` the output):

```bash
pnpm --filter docs run build
```

Output directory: `apps/docs/docs/.vitepress/dist/`

## 2. nginx configuration

Add the following `location` block inside the existing `taalwiz.nl` `server { }` block (the one that already handles `https://taalwiz.nl`):

```nginx
location /guide/ {
    alias /home/jim/taalwiz-mono/apps/docs/docs/.vitepress/dist/;
    index index.html;
    try_files $uri $uri/ =404;
}

# Serve VitePress's own 404 page for unknown paths under /guide/
error_page 404 /guide/404.html;
```

### Notes

- **`alias`** (not `root`) is required here because the URL path (`/guide/`) differs from the directory name (`dist/`). Both the `location` value and the `alias` value must end with `/`.
- VitePress generates a real `.html` file for every page, so `try_files` falling back to `=404` is correct — there is no SPA-style client-side routing to fall back to.
- TLS is handled by the existing Let's Encrypt certificate for `taalwiz.nl`. No additional certificate is required.

## 3. Apply the nginx change

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 4. Updating the docs

After editing Markdown source files and rebuilding:

```bash
pnpm --filter docs run build
sudo systemctl reload nginx   # usually not needed — static files are read on each request
```

Reloading nginx is only necessary if you change the nginx config itself, not when you update the static files.
