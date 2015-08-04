#### River4

River4 is a JavaScript river-of-news aggregator running in Node.js

#### How to install

Here are the <a href="http://river4.smallpict.com/2015/07/20/usingRiver4WithFilesystemStorage.html">instructions</a> for setting up River4 on a system running Node.js, using the local file system for storage.

#### Links

1. <a href="http://river4.smallpict.com/2014/06/04/welcomeToRiver4.html">Welcome to River4</a>. 

1. <a href="http://scripting.com/2014/06/02/whatIsARiverOfNewsAggregator.html">What is a River of News aggregator?</a>

2. <a href="http://www.niemanlab.org/2012/03/dave-winer-heres-why-every-news-organization-should-have-a-river/">Why every news organization should have a river</a>.

6. The River4 support <a href="https://groups.google.com/forum/?fromgroups#!forum/river4">mail list</a>. 

7. <a href="http://scripting.com/2014/03/19/howToAskForHelpWithSoftware.html">How to ask for help with software</a>.

9. The <a href="http://river4.smallpict.com/2014/10/05/theHelloWorldOfRivers.html">Hello World</a> of Rivers.

10. <a href="http://river4.smallpict.com/2015/08/04/editingSubscriptionLists.html">Editing subscription lists</a>. 

11. <a href="http://river4.smallpict.com/2015/08/04/installingRiver4OnUbuntu.html">Installing River4 on Ubuntu</a>.

#### Updates

##### v0.117 -- 7/20/15 by DW

Lots of small changes to make River4 easier to setup for newbies. ;-)

1. If you haven't set any path variables, or set up config.json, River4 will run with the data stored in a river4data sub-folder of the folder containing river4.js, which it automatically creates.

2. We don't announce each step of the startup process on the console. 

3. If there's an ENOENT error reading prefsAndStats.json, we don't report an error, since River4 automatically creates the file the first time it runs. This confused some users, unnecessarily. 

4. We create the <i>lists</i> folder automatically. 

5. We no longer install an index.html file in the river4data folder. The file we installed didn't actually work, and it's no longer necessary since the <a href="http://localhost:1337/">home page</a> of the server is now a perfectly good way to browse the rivers on the server.

5. Re-wrote the <a href="http://river4.smallpict.com/2015/07/20/usingRiver4WithFilesystemStorage.html">howto for setup</a>, eliminating two complicated and potentially error-prone steps. The old howto is still there but with a  bold statement at the top saying you should use the new one. 

6. There's a <a href="http://river4.smallpict.com/2015/07/20/videoInstallingRiver4OnAMac.html">15-minute video</a> that shows how to set up a River4 installation.

##### v0.116 -- 7/4/15 by DW

The home page of the River4 server now shows you the rivers being maintained by the server. There's a menu that links to the dashboard, the blog, mail list, and GitHub repo.

##### v0.115 -- 6/21/15 by DW

New feature: <a href="https://github.com/scripting/river4/wiki/How-callbacks-work-in-River4">Callback scripts</a> that run when River4 adds an item to the river. 

##### v0.114 -- 6/16/15 by DW

Fixed <a href="http://river4.smallpict.com/2015/06/16/jsonEncodingIssueSolved.html">JSON encoding problem</a> reported by Andrew Shell. 

##### v0.113 -- 6/7/15 by DW

We now record the current time in each item in the calendar structure. This is used when building a river to set the whenLastUpdate field. 

##### v0.112 -- 6/5/15 by DW

Now when we receive a message saying that a feed updated, we read the feed and rebuild all rivers that it's part of. I wanted to test the framework before going this step. 

Again, a careful code review and testing by others would be appreciated. 

##### v0.111 -- 6/4/15 by DW

Added support for <a href="http://walkthrough.rsscloud.co/">rssCloud</a>. Now if a feed has a &lt;cloud> element, we contact the server and go through the subscription protocol. If it all works, we'll be notified of updates to the feed before we poll. 

The rssCloud support is largely untested. However I have upgraded all my copies of River4 to run the new version, and it seems to be functioning well. Code review of the new functionality would be much appreciated. 

We also remove items from each feed's history array when the item no longer appears in the feed. This reduces the size of some of the files in the data folder, in general making the software more efficient. 

Fixed an error that would cause River4 to crash when there were no OPML subscription list files in the lists folder.

##### v0.110 -- 5/10/15 by DW

<a href="http://river4.smallpict.com/2015/05/10/newWayToConfigureRiver4.html">A new way</a> to configure River4, using a config.son file in the same directory as river4.js.

##### v0.109 -- 4/21/15 by DW

Fixed a bug that would cause generated rivers to be empty immediately after date rollover. 

The fix was to write out an empty array in the calendar structure when the date <a href="https://github.com/scripting/river4/blob/master/river4.js#L1543">rollover</a> occurs. The problem was that until there was a new item saved for the day, the first read of the calendar, when building a river would fail, causing the build to finish. 

The problem was discovered in <a href="http://podcatch.com/">podcatch.com</a>, and written up on the <a href="http://river4.smallpict.com/2015/04/21/foundASeriousRiver4Problem.html">River4 blog</a>.

##### v0.108 -- 12/5/14 by DW

There's now a River4 Console app, at http://river4.io/ that allows you to edit subscription lists in an outliner, and set some of the server preferences remotely. It's documented on the <a href="http://river4.smallpict.com/2014/12/05/newRiver4NewDashboardApp.html">River4 blog</a>. 

##### v0.100 -- 11/2/14 by DW

Fixed a <a href="https://groups.google.com/forum/?fromgroups#!topic/river4/vBU14ymOoaQ">bug</a> in file name processing.

##### v0.99 -- 11/1/14 by DW

Two fixes for local file system use. 1. Only read lists whose names end with .opml -- there were invisible files on the Mac that would cause problems. 2. When running on Windows and writing to the local file system, there are more illegal characters. Replace them with underscores.

##### v0.97 -- 10/16/14 by DW

Apparently there was a change in format in the FeedParser module, in the way it represents &lt;source:outline> elements. This release handles the change in format so outlines now pass through in a way that's understandable to the RiverBrowser software.

##### v0.96 -- 9/24/14 by DW

This version can be configured to store its data in the local filesystem instead of S3. See the <a href="http://river4.smallpict.com/2014/09/24/river4WorksWithLocalFilesystem.html">blog post</a> for details.

##### v0.95 -- 9/11/14 by DW

New /ping endpoint, available to be called by a publisher, on behalf of a user, to indicate that a feed has updated, and should be read immediately. <a href="http://radio3.smallpict.com/2014/09/11/radio3053HasASimpleApi.html">Radio3</a> has this facility as of today, as does Fargo. 

##### v0.94 -- 8/6/14 by DW

Fixed a problem that caused rivers to display only old stories. Full explanation on the <a href="http://river4.smallpict.com/2014/08/06/river4V094.html">blog</a>.

##### v0.93 -- 7/31/14 by DW

Added more fields to the struct the /status call returns. It now says what the s3path is, what port the server is running on, and if you've defined a s3defaultAcl (see v0.91) what the value of that parameter is.

##### v0.91 -- 7/19/14 by DW

A new environment variable, <i>s3defaultAcl,</i> if present specifies the permissions on S3 files we create. The default is public-read. With this parameter, it may be possible to run a private installation of River4. 

##### v0.90 -- 7/19/14 by DW

New &lt;source:outline> elements flow through River4. See the docs for the <a href="http://source.smallpict.com/2014/07/12/theSourceNamespace.html">source namespace</a> for details. 

##### v0.89 -- 6/19/14 by DW

One small change to package.json, and no changes to the JavaScript code.

##### v0.88 -- 6/17/14 by DW

A subscription list can now contain an include node, so you can have a list of lists. Full explanation in this <a href="http://river4.smallpict.com/2014/06/17/river4V088.html">blog post</a>.

Changed the package.json file to require Node v0.8.x. Previously it was 0.6.x. This should make it possible to deploy on Nodejitsu without modification, per <a href="https://groups.google.com/d/msg/river4/r8kSLjfZo6Q/msXpBg_6zG0J">Dave Seidel's report</a>.

##### v0.87 -- 6/09/14 by DW

Fixed a bug that would cause River4 to crash when processing an item with a null title. 

##### v0.86 -- 6/09/14 by DW

Fixed a bug that would cause River4 to crash when reading an item from a subscription list that didn't have an xmlUrl attribute. 

##### v0.85 -- 6/07/14 by DW

Two fixes, explained <a href="http://river4.smallpict.com/2014/06/07/river4V085.html">here</a>.

##### v0.84 -- 6/06/14 by DW

Two fixes, explained <a href="http://river4.smallpict.com/2014/06/06/river4V084.html">here</a>.

##### v0.83 -- 6/06/14 by DW

Now if there's an error in any JSON code we try to parse, we display an error message in the console, along with the path to the S3 file we were trying to read. 

##### v0.81 -- 6/02/14 by DW

serverData.stats now has a copy of the last story added to the river. The dashboard page displays it.

##### v0.80 -- 6/02/14 by DW

New "dashboard" feature. If your server is running at aggregator.mydomain.com, if you go to:

<code>http://aggregator.mydomain.com/dashboard</code>

You'll get a real-time readout of what your aggregator is doing. 

The HTML source for the dashboard page is in dashboard.opml in the opml folder in the repository.

#### Docker

There is an experimental Docker installer. Notes about using it are <a href="https://github.com/scripting/river4/wiki/Installing-with-Docker">on the wiki</a>. 

#### Amazon S3, Heroku

When we started developing River4, we were targeting Heroku, because it was so easy and inexpensive to start with. They have since <a href="http://scripting.com/2015/05/12/whyIMovedOffHeroku.html">changed</a> their pricing, so it's not as attractive, so we're now recommending the filesystem configuration, above. 

1. The <a href="http://river4.smallpict.com/2014/10/17/usingRiver4WithS3Storage.html">howto</a> with instructions for installing River4 using Amazon S3 for storage. 

3. <a href="http://scripting.com/2014/02/06/herokuForPoetsBeta.html">Heroku How To</a> -- get a Heroku server running with <a href="https://github.com/scripting/fargoPublisher">Fargo Publisher</a>, the back-end for <a href="http://fargo.io/">Fargo</a>. 

4. <a href="http://scripting.com/2014/04/20/barebonesHerokuDo.html">Bare-bones Heroku do</a> -- checklist for setting up a Heroku server running Node.js from a Mac desktop.

#### Thanks!

Thanks to two developer friends, Dan MacTough and Eric Kidd, who helped this Node.js newbie get this app up and running. 

Specifically thanks to Dan for writing the excellent <a href="https://github.com/danmactough/node-feedparser">feedparser</a> and <a href="https://github.com/danmactough/node-opmlparser">opmlparser</a> packages that are incorporated in River4. 

#### Notes

1. I edit code in an outliner, which is then turned into JavaScript. The "opml" folder in the repository contains the versions of the code that I edit. The comments are stripped out of the code before it's converted to raw JS, so there is information for developers in the OPML that isn't in the main files (though all the running code is in both).

2. The first released version is 0.79. They will increment by one one-hundredth every release. At some point I'll call it 1.0, then subsequent releases will be 1.01, 1.02 etc.

#### Questions, comments?

Please post a note on the <a href="https://groups.google.com/forum/?fromgroups#!forum/river4">River4</a> mail list. 

