import { mkdir, rm, writeFile } from 'node:fs/promises';

const outputDir = new URL('../dist/', import.meta.url);
const targetOrigin = 'https://tricord.pages.dev';

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <meta http-equiv="refresh" content="0; url=${targetOrigin}/" />
    <title>Redirecting to TriCord</title>
    <script>
      (function () {
        var targetOrigin = ${JSON.stringify(targetOrigin)};
        var path = window.location.pathname || "/";
        if (path.charAt(0) !== "/") path = "/" + path;
        window.location.replace(targetOrigin + path + window.location.search + window.location.hash);
      })();
    </script>
  </head>
  <body>
    Redirecting to <a href="${targetOrigin}/">TriCord</a>.
  </body>
</html>
`;

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await writeFile(new URL('_redirects', outputDir), '/*  https://tricord.pages.dev/:splat  301!\n');
await writeFile(new URL('index.html', outputDir), html);
await writeFile(new URL('404.html', outputDir), html);
