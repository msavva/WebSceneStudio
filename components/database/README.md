Database
===========

The Quotidian Database
------------------------

To get access to the database in your node module, include the following
chunk of code at the top

```javascript
var rootdir     = process.env.SCENE_STUDIO_ROOT;
var dbdir       = rootdir + '/components/database';

var dbwrite     = require(dbdir + '/dbwrite');
var queries     = require(dbdir + '/queries');
var dbwrapper   = require(dbdir + '/dbwrapper')();
    dbwrapper.mixin(dbwrite).mixin(queries);

var dbConstants = require(dbdir + '/constants');
```

A database object can be created

```javascript
var db = dbwrapper.db();
```

and used

```javascript
db.getUserSceneList(user_id, function(err, scene_list) {
    db.close();
    if(err) {
        console.log(err); // send a proper error response???
        scene_list = [];
    }
    // do something with scene_list
});
```

Remember!  Always `db.close()` the connection when you're done, regardless
of whether you encountered an error or not.

Now, let's take a look at developing with the database in more detail!


Including the Database
------------------------

The above header block of includes can really be trimmed down to a
single line

```javascript
var dbwrapper = require(dbdir + '/dbwrapper')();
```

However, you then have the option of mixing in extra palettes of functions.
Right now, dbwrite is dependent on queries, so if you want to write to the
database, please include both mixins.


The Schema
------------

In order to undertand the database, you want to understand the schema.
The most reliable way to check the current schema is to log into your
mysql server and query the database using commands like `show tables;` and
`show columns from table_name;`

While it's foolhardy to expect documentation to keep up to date with the
actual code and schema, there are a couple of funky design decisions
made for the schema which are probably better documented here.

At the time of creation, the schema contains 5 tables which occur in
3 distinct groupings:
* the USER table
* the assets tables (MODEL and TEXTURE)
* the scene versioning tables (SCENE and SCENE_VERSION)

All 5 tables subscribe to some common conventions.
* Do not delete data.  Instead maintain `private` and `deleted` fields.
  By filtering queries, we can present the database to the user as if
  the data has been deleted without actually having to do so.
* Even if a table is uniquely indexable by a name or filename string,
  maintain a distinct primary key `id` column.  All foreign key references
  within the database should then use this id.  Following this policy
  allows for table entries to be renamed without breaking inter-table
  references.

Additionally, SCENE and SCENE_VERSION are designed in a peculiar way
in order to support versioning and forking.
* Every scene in the database has exactly one entry in the SCENE table.
  This entry is uniquely indexable given both the owning USER
  and the scene's name.  For each such scene there is at least one
  corresponding entry in the SCENE_VERSION table. (More likely, there are many)
* The entries in SCENE_VERSION are linked in a forest-like manner.  This
  structure can be inferred by following the `parent-version` references.
* The entries in SCENE can be viewed as read/write heads (in the git sense)
  tracking this forest of scene versions.  Whenever a scene is updated,
  a new version blob is appended to the given head and the head is advanced.
* For efficiency, the heads redundantly keep track of which other head they
  were forked from initially (if any).
* This entire scheme can be hidden behind a view (such as `current_scene`)
  in order to present the fiction that only the most current version of
  a given scene exists.


Lower Level Database Functionality and Utility Functions (dbwrapper)
----------------------------------------------------------------------

In `dbwrapper` you can find a number of useful routines for building
more complicated database functionality out of:
* `db.execute(cmd, values, callback)` This function allows you to run
  SQL queries directly.  If a non-empty array of values is passed, then
  a prepared statement will be executed instead of a query.
  Errors will be passed to the callback following
  standard node convention ( signature: `callback(err, result)` ).
* `db.startTransaction(callback)`, `db.commit(callback)`, and
  `db.rollback(callback)` execute the corresponding SQL commands
* `db.transactionSequence(waterfallSequence, callback)` works like a
  call to `async.waterfall(seq, callback)`, except the entire sequence is
  wrapped in a transaction start and finish.  If no error is encountered,
  the transaction is committed.  If an error is encountered, then the
  transaction is rolled back.


How to Change the Schema (aka. Migrations)
--------------------------------------------

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
