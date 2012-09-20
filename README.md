WebSceneStudio
==============

Installation / Setup
--------------
1. set the environment variable `SCENE_STUDIO_ROOT` to contain the absolute
   path to the project's root directory.

2. run the following command in the project root directory

        npm install

  Running this command downloads the latest versions of all the node modules
  we depend on.

3. Create a MySQL database with a name of your choice.  We will assume
  `SceneStudioDB` has been chosen for the rest of this guide.

4. Create a new options file named `options.json` in the project root
  directory.  Fill out this options file with the credentials for
  the database you just created.  The file should have the following format:

    ```javascript
    {
        "db_login": {
            "database":     "SceneStudioDB",
            "user":         "mysql_user_name",
            "password":     "mysql_password"
        }
    }
    ```

5. Bring the database schema up to date.  To do this run

        tools/db/migrate up

6. Create an administrator user account.  To do this run the command

        tools/db/newUser admin_user_name

7. Copy an intial set of model data into the model directory.
  (This item needs more explanation for any public release)

8. Populate the model database with the initial set of models.  When models
  are later uploaded, they are "owned" by the uploader.  Similarly, all of
  these initial models must be owned by some user, in this case our
  administrator account.  To register all the data, run

        tools/db/initDataUpload admin_user_name

9. ... anything else?

10. To launch the server, run

        node app

  in the root directory.

Maintenance
--------------

TODO: explain any maintenance scripts here

Development
--------------

###Database

See [`components/database/README.md`](components/database) for 
 information on how to use the database code, how to make changes to
the schema, and why the schema is set up the way it is.

Structure of Project
--------------

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