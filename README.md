WebSceneStudio
==============

Structure of Project

- app.js is the main file to start the server; Launch using command
> node app
- node_modules holds node libraries we are dependent on; standard for npm
- package.json is no longer necessary as best I can tell
- components defines the dynamic content and behavior of the web site
- public holds static files which are served up to the client
- tools holds programs which are useful for server maintenance.

components/
-   express holds handlers and middleware for the app
-   servers holds servers to be run in child processes
-   subproc holds short-lived commands to be invoked as child processes
-   views holds definitions of dynamic pages specified in jade
-   middleware holds connect.js style middleware for the app

public/
-   data holds various model data files
-   images holds a small collection of images for use on the web page
-   javascripts holds all of the client side javascripts
-   stylesheets -- duh
-   NOTE: static items in public are not addressed as (e.g.)
>       /public/images/lolcat.png
-   but rather directly as
>       /images/lolcat.png

tools/
-   ... nothing yet