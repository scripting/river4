river4
======

A node.js river-of-news aggregator that runs from Amazon S3.

#### How to install

1. Create an S3 bucket to hold all your subscription lists, rivers, and data for the aggregator. 

2. On the node.js system, set an environment variable, s3path, to contain the path to the bucket created in step 1.

   <code>export s3path=/river.mydomain.com/</code>

3. Launch river4.js on a node.js system. Suppose that server is aggregator.mydomain.com.

4. Look in the bucket. You should see a data folder, with a single file in it containing the default value of prefs and stats for the app.

5. Create a folder at the top level of the bucket called "lists". Save one or more OPML subscription lists into that folder.

6. After a while you should see a new folder called "rivers" created automatically by the software. In that folder you should see one JSON file for each list. It contains the news from those feeds, discovered by River4. This format is designed to plug into the beautfiul" river displayer. 

7. If you want to watch the progress of the aggregator, you can view this page. 

    <code>http://aggregator.mydomain.com/serverdata</code>

#### Notes

1. I edit code in an outliner, which is then turned into JavaScript. The "opml" folder in the repository contains the versions of the code that I edit. The comments are stripped out of the code before it's converted to raw JS, so there is information for developers in the OPML that isn't in the main files (though all the running code is in both).

2. The first released version is 0.76. They will increment by one one-hundredth every release. At some point I'll call it 1.0, then subsequent releases will be 1.01, 1.02 etc.

#### Coming soon

There will be an update to River4 that creates a tabbed river browser for you automatically, one that displays the contents of your river. It will also have a dashboard that monitors the aggregator.

