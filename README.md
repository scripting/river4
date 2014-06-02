river4
======

River4 is a node.js <a href="http://www.niemanlab.org/2012/03/dave-winer-heres-why-every-news-organization-should-have-a-river/">river-of-news</a> aggregator that runs from Amazon S3.

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

#### Changes

##### v0.81 -- 6/02/14 by DW

serverData.stats now has a copy of the last story added to the river. The dashboard page displays it.

##### v0.80 -- 6/02/14 by DW

New "dashboard" feature. If your server is running at aggregator.mydomain.com, if you go to:

<code>http://aggregator.mydomain.com/dashboard</code>

You'll get a real-time readout of what your aggregator is doing. 

The HTML source for the dashboard page is in dashboard.opml in the opml folder in the repository.


