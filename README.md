river4
======

River4 is a node.js <a href="http://scripting.com/2014/06/02/whatIsARiverOfNewsAggregator.html">river-of-news</a> aggregator that stores its lists and data in Amazon S3.

####Overview

We have a <a href="http://river4.smallpict.com/2014/06/04/welcomeToRiver4.html">press backgrounder</a> for River4 here. If you're wondering what it is, or why it's significant, this is the first place to go.

If you need help, we have a <a href="https://groups.google.com/forum/?fromgroups#!forum/river4">support mail list</a>, with people who have successfully set up and are running River4 installations. If you're having trouble, this is the place to go.

If you're ready to install the software, you've come to the right place! :-)

#### What you'll need

1. A node.js installation.

2. An Amazon account, and an S3 bucket to store the JSON files, and a small HTML file.

3. One or more OPML subscription list files.

#### How to install

1. Create an S3 bucket to hold all your subscription lists, rivers, and data for the aggregator. 

2. On the node.js system, set an environment variable, s3path, to contain the path to the bucket created in step 1.

   <code>export s3path=/river.mydomain.com/</code>

3. Again, on the node.js system, set the two AWS environment variables. This allows the River4 app to write to your bucket.

   <code>export AWS_ACCESS_KEY_ID=12345</code>

   <code>export AWS_SECRET_ACCESS_KEY=TUVWXYZ</code>

4. Launch river4.js on a node.js system. Suppose that server is aggregator.mydomain.com.

5. Look in the bucket. You should see a data folder, with a single file in it containing the default value of prefs and stats for the app. There's also an index.html file, which will display your rivers in a simple way, providing code you can crib to create your own way of browsing (room for improvement here, for sure).

6. Create a folder at the top level of the bucket called "lists". Save one or more OPML subscription lists into that folder.

7. After a while you should see a new folder called "rivers" created automatically by the software. In that folder you should see one JSON file for each list. It contains the news from those feeds, discovered by River4. This format is designed to plug into the beautfiul" river displayer. 

8. If you want to watch the progress of the aggregator, you can view this page. 

    <code>http://aggregator.mydomain.com/serverdata</code>

#### Notes

1. I edit code in an outliner, which is then turned into JavaScript. The "opml" folder in the repository contains the versions of the code that I edit. The comments are stripped out of the code before it's converted to raw JS, so there is information for developers in the OPML that isn't in the main files (though all the running code is in both).

2. The first released version is 0.79. They will increment by one one-hundredth every release. At some point I'll call it 1.0, then subsequent releases will be 1.01, 1.02 etc.

3. When you set up your S3 bucket, make sure that web hosting is enabled and index.html is the name of your index file. Here's a <a href="http://static.scripting.com/larryKing/images/2014/06/01/bucketSetup.gif">screen shot</a> that shows how to set it up. 

#### Links

1. <a href="http://scripting.com/2014/06/02/whatIsARiverOfNewsAggregator.html">What is a River of News aggregator?</a>

2. <a href="http://www.niemanlab.org/2012/03/dave-winer-heres-why-every-news-organization-should-have-a-river/">Why every news organization should have a river</a>.

3. <a href="http://scripting.com/2014/02/06/herokuForPoetsBeta.html">Heroku How To</a> -- get a Heroku server running with <a href="https://github.com/scripting/fargoPublisher">Fargo Publisher</a>, the back-end for <a href="http://fargo.io/">Fargo</a>. 

4. <a href="http://scripting.com/2014/04/20/barebonesHerokuDo.html">Bare-bones Heroku do</a> -- checklist for setting up a Heroku server running Node.js from a Mac desktop.

5. <a href="http://river4.smallpict.com/2014/06/04/welcomeToRiver4.html">Welcome to River4</a>.

6. The River4 support <a href="https://groups.google.com/forum/?fromgroups#!forum/river4">mail list</a>. 

7. <a href="http://scripting.com/2014/03/19/howToAskForHelpWithSoftware.html">How to ask for help with software</a>.

8. Chris Dadswell wrote a <a href="http://scriven.chrisdadswell.co.uk/users/scriven/articles/howToSetupAFargoRiverOfNews.html">tutorial</a> for setting up your own River4 installation. 

#### Thanks!

Thanks to two developer friends, Dan MacTough and Eric Kidd, who helped this Node.js newbie get this app up and running. 

Specifically thanks to Dan for writing the excellent <a href="https://github.com/danmactough/node-feedparser">feedparser</a> and <a href="https://github.com/danmactough/node-opmlparser">opmlparser</a> packages that are incorporated in River4. 

#### Changes

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


