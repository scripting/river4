river4
======

River4 is a node.js <a href="http://scripting.com/2014/06/02/whatIsARiverOfNewsAggregator.html">river-of-news</a> aggregator that stores its lists and data in the local file system or Amazon S3.

####Overview

We have a <a href="http://river4.smallpict.com/2014/06/04/welcomeToRiver4.html">press backgrounder</a> for River4 here. If you're wondering what it is, or why it's significant, this is the first place to go.

If you need help, we have a <a href="https://groups.google.com/forum/?fromgroups#!forum/river4">support mail list</a>, with people who have successfully set up and are running River4 installations. If you're having trouble, this is the place to go.

####Installing the software

There are two howto's:

1. Setting up River4 <a href="http://river4.smallpict.com/2014/09/25/bareBonesRiver4Howto.html">using the local file system</a> for storage.

2. Or, <a href="http://river4.smallpict.com/2014/10/17/usingRiver4WithS3Storage.html">using Amazon S3</a> for storage.

The first option is easier, and often less expensive. However, if you're running River4 on a service like Heroku, you can't rely on the local file system for persistent storage, so we built River4 to work with S3 as well. On Heroku, which runs in the Amazon cloud, access to S3 storage is free.


#### Notes

1. I edit code in an outliner, which is then turned into JavaScript. The "opml" folder in the repository contains the versions of the code that I edit. The comments are stripped out of the code before it's converted to raw JS, so there is information for developers in the OPML that isn't in the main files (though all the running code is in both).

2. The first released version is 0.79. They will increment by one one-hundredth every release. At some point I'll call it 1.0, then subsequent releases will be 1.01, 1.02 etc.

#### Links

1. <a href="http://scripting.com/2014/06/02/whatIsARiverOfNewsAggregator.html">What is a River of News aggregator?</a>

2. <a href="http://www.niemanlab.org/2012/03/dave-winer-heres-why-every-news-organization-should-have-a-river/">Why every news organization should have a river</a>.

3. <a href="http://scripting.com/2014/02/06/herokuForPoetsBeta.html">Heroku How To</a> -- get a Heroku server running with <a href="https://github.com/scripting/fargoPublisher">Fargo Publisher</a>, the back-end for <a href="http://fargo.io/">Fargo</a>. 

4. <a href="http://scripting.com/2014/04/20/barebonesHerokuDo.html">Bare-bones Heroku do</a> -- checklist for setting up a Heroku server running Node.js from a Mac desktop.

5. <a href="http://river4.smallpict.com/2014/06/04/welcomeToRiver4.html">Welcome to River4</a>.

6. The River4 support <a href="https://groups.google.com/forum/?fromgroups#!forum/river4">mail list</a>. 

7. <a href="http://scripting.com/2014/03/19/howToAskForHelpWithSoftware.html">How to ask for help with software</a>.

8. Chris Dadswell wrote a <a href="http://scriven.chrisdadswell.co.uk/users/scriven/articles/howToSetupAFargoRiverOfNews.html">tutorial</a> for setting up your own River4 installation. 

9. The <a href="http://river4.smallpict.com/2014/10/05/theHelloWorldOfRivers.html">Hello World</a> of Rivers.

#### Thanks!

Thanks to two developer friends, Dan MacTough and Eric Kidd, who helped this Node.js newbie get this app up and running. 

Specifically thanks to Dan for writing the excellent <a href="https://github.com/danmactough/node-feedparser">feedparser</a> and <a href="https://github.com/danmactough/node-opmlparser">opmlparser</a> packages that are incorporated in River4. 

#### Changes

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


