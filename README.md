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

###Database Migrations

While developing on the project, there's a good chance that you'll want to
change something about the current database schema.  BEWARE! Mucking around
with the database incorrectly can end up destroying precious data
that you've collected.  In order to prevent such catastrophe and ease the
development of changes to the database, we're using a very lightweight
migration system.

The database migration system consists of
* a directory of migration scripts `components/database/migrations`
* a tool `tools/db/migrate`
* and a set of best practices detailed below.

To make a modification to the database schema,
1. Create a new migration script.  To do this run

        tools/db/migrate create short_migration_name

   This will create a migration script `###-short_migration_name.js` in the
   `components/database/migrations` directory.

2. Fill out the `up` and `down` stubs in this file.  The `down` function
   should always undo the effects of the `up` function.

3. To run this script (and any other un-run migration scripts) run

        tools/db/migrate up

__NEVER__
* delete or modify a checked-in migration script
* ...

__ALWAYS__
* make sure you back up any database with important data before you apply any
  migrations to it.

For more details on using the `migrate` tool, please see the project page:
https://github.com/visionmedia/node-migrate


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