var myVersion = "0.122a", myProductName = "River4"; 

/*  The MIT License (MIT)
	Copyright (c) 2014-2015 Dave Winer
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
	
	structured listing: http://scripting.com/listings/river4.html
	*/

var http = require ("http"); 
var https = require ("https");
var AWS = require ("aws-sdk");
var s3 = new AWS.S3 ();
var md5 = require ("MD5");
var OpmlParser = require ("opmlparser");
var FeedParser = require ("feedparser");
var request = require ("request");
var urlpack = require ("url");
var util = require ("util");
var fs = require ("fs");
var qs = require ("querystring");
var utils = require ("./lib/utils.js"); //8/13/15 by DW

var fspath = process.env.fspath; //9/24/14 by DW
var remotePassword = process.env.password; //12/4/14 by DW
var flWatchAppDateChange = false, fnameApp = "river4.js", origAppModDate; //8/21/15 by DW -- can only be sent through config.json
    
var s3path = process.env.s3path; 
var s3UserListsPath; 
var s3UserRiversPath; 
var s3PrefsAndStatsPath;
var s3LocalStoragePath; //6/22/15 by DW
var s3FeedsArrayPath;
var s3RiversArrayPath;
var s3FeedsInListsPath;
var s3FeedsDataFolder;
var s3CalendarDataFolder;
var s3ListsDataFolder;
var s3BackupsFolder; //12/4/14 by DW
var s3IndexFile;

var myPort = Number (process.env.PORT || 1337);

var urlIndexSource = "http://fargo.io/code/river4/river4homepage.html";
var urlDashboardSource = "http://fargo.io/code/river4/dashboard.html";
var urlServerHomePageSource = "http://fargo.io/code/river4/serverhomepage.html"; //what you get when you go to / on the server
var urlFavicon = "http://fargo.io/favicon.ico"; //7/19/15 by DW

var whenServerStart = new Date ();
var ct = 0, secsLastInit = 0;

var serverData = {
	prefs: {
		enabled: true,
		ctMinutesBetwBuilds: 15,
		maxConsecutiveFeedErrors: 100,
		maxThreads: 10,
		ctReadsPerSecond: 2,
		maxRiverItems: 100,
		maxBodyLength: 280,
		flSkipDuplicateTitles: true,
		flWriteItemsToFiles: false, //debugging -- 5/30/14 by DW
		flRequestCloudNotify: true //6/4/15 by DW
		},
	stats: {
		aggregator: "",
		ctHoursServerUp: 0,
		ctFeedReads: 0,
		ctFeedsReadThisScan: 0,
		ctFeedReadsLastHour: 0,
		ctFeedReadsThisRun: 0,
		ctReadsSkipped: 0,
		lastFeedRead: "", 
		whenLastFeedRead: new Date (0), 
		secsSinceLastFeedRead: 0,
		serialnum: 0, //each new story gets a number
		ctStoriesAdded: 0,
		ctStoriesAddedThisRun: 0,
		whenLastStoryAdded: new Date (0),
		ctHits: 0, ctHitsToday: 0, ctHitsThisRun: 0,
		ctMinutes: 0,
		ctScans: 0,
		whenLastScanBegin: new Date (0), 
		whenLastScanEnd: new Date (0),
		flScanningNow: false,
		ctRiverSaves: 0,
		whenLastRiverSave: new Date (0),
		ctRiverSaveErrors: 0,
		whenLastRiverSaveError: new Date (0),
		ctActiveThreads: 0,
		ctHttpSockets: 0,
		whenLastBuild: new Date (),
		ctListFolderReads: 0,
		whenLastListFolderRead: new Date (0),
		listNames: new Array (),
		ctRiverJsonSaves: 0,
		whenLastRiverJsonSave: new Date (0), 
		ctListSaves: 0, 
		whenLastListSave: new Date (0), 
		backupSerialnum: 0, 
		ctRssCloudUpdates: 0,
		whenLastRssCloudUpdate: new Date (0),
		ctLocalStorageWrites: 0,
		whenLastLocalStorageWrite: new Date (0)
		},
	flags: []
	}
var flHaveServerData = false; 

var feedsArray = [], flFeedsArrayDirty = false;

var feedsInLists = {}, flFeedsInListsDirty = false; //5/30/14 by DW

var todaysRiver = [], dayRiverCovers = new Date (), flRiverDirty = false;

var whenLastEveryMinute = new Date ();
var whenLastRiversBuild = new Date (); //8/6/14 by DW

var fnameConfig = "config.json"; //5/9/15 by DW
var appConfig; //6/4/15 by DW -- the contents of config.json available to all code

var addToRiverCallbacksFolder = "callbacks/addToRiver/"; //6/19/15 by DW
var flScheduledEveryMinute = false; //8/22/15 by DW



 

var s3defaultType = "text/plain";
var s3defaultAcl = "public-read";

var s3stats = {
	ctReads: 0, ctBytesRead: 0, ctReadErrors: 0, 
	ctWrites: 0, ctBytesWritten: 0, ctWriteErrors: 0
	};

function s3SplitPath (path) { //split path like this: /tmp.scripting.com/testing/one.txt -- into bucketname and path.
	var bucketname = "";
	if (path.length > 0) {
		if (path [0] == "/") { //delete the slash
			path = path.substr (1); 
			}
		var ix = path.indexOf ("/");
		bucketname = path.substr (0, ix);
		path = path.substr (ix + 1);
		}
	return ({Bucket: bucketname, Key: path});
	}
function s3NewObject (path, data, type, acl, callback, metadata) {
	var splitpath = s3SplitPath (path);
	if (type === undefined) {
		type = s3defaultType;
		}
	if (acl === undefined) {
		acl = s3defaultAcl;
		}
	var params = {
		ACL: acl,
		ContentType: type,
		Body: data,
		Bucket: splitpath.Bucket,
		Key: splitpath.Key,
		Metadata: metadata
		};
	s3.putObject (params, function (err, data) { 
		if (err) {
			console.log ("s3NewObject: error == " + err.message);
			s3stats.ctWriteErrors++;
			if (callback != undefined) {
				callback (err, data);
				}
			}
		else {
			s3stats.ctWrites++;
			s3stats.ctBytesWritten += params.Body.length;
			if (callback != undefined) {
				callback (err, data);
				}
			}
		});
	}
function s3Redirect (path, url) { //1/30/14 by DW -- doesn't appear to work -- don't know why
	var splitpath = s3SplitPath (path);
	var params = {
		WebsiteRedirectLocation: url,
		Bucket: splitpath.Bucket,
		Key: splitpath.Key,
		Body: " "
		};
	s3.putObject (params, function (err, data) { 
		if (err != null) {
			console.log ("s3Redirect: err.message = " + err.message + ".");
			}
		else {
			console.log ("s3Redirect: path = " + path + ", url = " + url + ", data = ", JSON.stringify (data));
			}
		});
	}
function s3GetObjectMetadata (path, callback) {
	var params = s3SplitPath (path);
	s3.headObject (params, function (err, data) {
		callback (data);
		});
	}
function s3GetObject (path, callback) {
	var params = s3SplitPath (path);
	s3.getObject (params, function (err, data) {
		if (err) {
			s3stats.ctReadErrors++;
			}
		else {
			s3stats.ctReads++;
			s3stats.ctBytesRead += data.Body.length;
			}
		callback (err, data);
		});
	}
function s3ListObjects (path, callback) {
	var splitpath = s3SplitPath (path);
	function getNextGroup (marker) {
		var params = {Bucket: splitpath.Bucket, Prefix: splitpath.Key};
		if (marker != undefined) {
			params = {Bucket: splitpath.Bucket, Prefix: splitpath.Key, Marker: marker};
			}
		s3.listObjects (params, function (err, data) {
			if (err) {
				console.log ("s3ListObjects: error == " + err.message);
				}
			else {
				var lastobj = data.Contents [data.Contents.length - 1];
				for (var i = 0; i < data.Contents.length; i++) {
					data.Contents [i].s3path = splitpath.Bucket + "/" + data.Contents [i].Key; //5/22/14 by DW
					callback (data.Contents [i]);
					}
				if (data.IsTruncated) {
					getNextGroup (lastobj.Key);
					}
				else {
					var obj = new Object ();
					obj.flLastObject = true;
					callback (obj);
					}
				}
			});
		}
	getNextGroup ();
	}





var taskQ = []; 
function qNotEmpty () {
	return (taskQ.length > 0);
	}
function qSize () {
	return (taskQ.length);
	}
function qAddTask (taskcode, taskdata) { //add task at end of array
	if (taskcode === undefined) {
		taskcode = "";
		}
	if (taskdata === undefined) {
		taskdata = {};
		}
	taskQ [taskQ.length] = {
		code: taskcode,
		data: taskdata
		};
	}
function qRunNextTask () { //run the task at the beginning of array
	if (qNotEmpty ()) {
		var theTask = taskQ [0];
		if (theTask.data !== undefined) {
			with (theTask.data) {
				eval (theTask.code);
				}
			}
		else {
			eval (theTask.code);
			}
		taskQ.splice (0, 1); //remove first item
		}
	}

 
var riverCache = new Object (), flUseRiverCache = false, flRunningOnServer = true;

function clearBuildRiverCache () {
	riverCache = new Object ();
	}
function getCalendarPath (theDay) {
	if (theDay == undefined) {
		theDay = dayRiverCovers;
		}
	return (s3CalendarDataFolder + utils.getDatePath (theDay, false) + ".json");
	}
function buildOneRiver (listname, flSave, flSkipDuplicateTitles, flAddJsonpWrapper) { 
	var theRiver = new Object (), starttime = new Date (), ctitems = 0, flEndOfSource = false, titles = new Object (), ctDuplicatesSkipped = 0;
	if (flSave == undefined) {
		flSave = true;
		}
	if (flSkipDuplicateTitles == undefined) {
		flSkipDuplicateTitles = true;
		}
	if (flAddJsonpWrapper == undefined) {
		flAddJsonpWrapper = true;
		}
	theRiver.updatedFeeds = new Object ();
	theRiver.updatedFeeds.updatedFeed = new Array ();
	
	function getRiverForDay (d, callback) {
		var s3path = getCalendarPath (d);
		if (flRunningOnServer) {
			stGetObject (s3path, function (error, data) {
				if (error) {
					callback (undefined);
					}
				else {
					var struct = parseJson (data.Body, s3path);
					callback (struct);
					}
				});
			}
		else {
			var url = "http:/" + s3path; 
			readHttpFile (url, function (jsontext) {
				if (jsontext == undefined) {
					callback (undefined);
					}
				else {
					var struct = parseJson (jsontext);
					callback (struct);
					}
				});
			}
		}
	function finishBuild () {
		var jsontext;
		theRiver.metadata = {
			name: listname,
			docs: "http://scripting.com/stories/2010/12/06/innovationRiverOfNewsInJso.html",
			secs: utils.secondsSince (starttime),
			ctDuplicatesSkipped: ctDuplicatesSkipped,
			whenGMT: starttime.toUTCString (),
			whenLocal: starttime.toLocaleString (),
			aggregator: myProductName + " v" + myVersion
			};
		jsontext = utils.jsonStringify (theRiver, true);
		if (flAddJsonpWrapper) {
			jsontext = "onGetRiverStream (" + jsontext + ")";
			}
		if (flSave) {
			var fname = utils.stringPopLastField (listname, ".") + ".js";
			stNewObject (s3UserRiversPath + fname, jsontext, "application/json", s3defaultAcl, function (error, data) {
				console.log ("buildOneRiver: " + s3UserRiversPath + fname + ".");
				serverData.stats.ctRiverJsonSaves++;
				serverData.stats.whenLastRiverJsonSave = starttime;
				});
			}
		else {
			console.log (jsontext);
			}
		}
	function doOneDay (theDay) {
		if (flEndOfSource) {
			finishBuild ();
			}
		else {
			getRiverForDay (theDay, function (theDaysRiver) {
				if (theDaysRiver == undefined) { //error reading the source file
					finishBuild ();
					}
				else {
					var lastfeedurl = undefined, theRiverFeed, flThisFeedInList;
					for (var i = theDaysRiver.length - 1; i >= 0; i--) {
						var story = theDaysRiver [i], flskip = false, reducedtitle;
						if (flSkipDuplicateTitles) { //5/29/14 by DW
							reducedtitle = utils.trimWhitespace (utils.stringLower (story.title));
							if (reducedtitle.length > 0) { //6/6/14 by DW
								if (titles [reducedtitle] != undefined) { //duplicate
									ctDuplicatesSkipped++;
									flskip = true;
									}
								}
							}
						if (!flskip) {
							if (story.feedUrl != lastfeedurl) {
								var feedstats = findInFeedsArray (story.feedUrl);
								flThisFeedInList = false;
								
								if (feedstats !== undefined) { //10/30/15 by DW -- an item appears in a river but we're no longers subscribed to its feed
									for (var j = 0; j < feedstats.lists.length; j++) {
										if (feedstats.lists [j] == listname) {
											flThisFeedInList = true;
											break;
											}
										}
									}
								
								if (flThisFeedInList) {
									var ix = theRiver.updatedFeeds.updatedFeed.length;
									theRiver.updatedFeeds.updatedFeed [ix] = new Object ();
									theRiverFeed = theRiver.updatedFeeds.updatedFeed [ix];
									
									theRiverFeed.feedTitle = feedstats.title;
									theRiverFeed.feedUrl = story.feedUrl;
									theRiverFeed.websiteUrl = feedstats.htmlurl;
									//description
										if (feedstats.description == undefined) {
											theRiverFeed.feedDescription = "";
											}
										else {
											theRiverFeed.feedDescription = feedstats.description;
											}
									//whenLastUpdate -- 6/7/15 by DW
										if (story.when !== undefined) {
											theRiverFeed.whenLastUpdate = new Date (story.when).toUTCString ();
											}
										else {
											theRiverFeed.whenLastUpdate = new Date (feedstats.whenLastNewItem).toUTCString ();
											}
									theRiverFeed.item = new Array ();
									}
								
								lastfeedurl = story.feedUrl;
								}
							if (flThisFeedInList) { //add an item to this set of updates to the feed
								var ix = theRiverFeed.item.length, theItem;
								theRiverFeed.item [ix] = new Object ();
								theItem = theRiverFeed.item [ix];
								theItem.title = story.title;
								theItem.link = story.link;
								theItem.body = story.description;
								
								if (story.outline != undefined) { //7/16/14 by DW
									theItem.outline = story.outline;
									}
								
								theItem.pubDate = new Date (story.pubdate).toUTCString ();
								theItem.permaLink = story.permalink;
								if (story.comments.length > 0) { //6/7/14 by DW
									theItem.comments = story.comments;
									}
								//enclosure -- 5/30/14 by DW
									if (story.enclosure != undefined) {
										var flgood = true;
										
										if ((story.enclosure.type == undefined) || (story.enclosure.length === undefined)) { //both are required
											flgood = false; //sorry! :-(
											}
										else {
											if (utils.stringCountFields (story.enclosure.type, "/") < 2) { //something like "image" -- not a valid type
												flgood = false; //we read the spec, did you? :-)
												}
											}
										
										if (flgood) {
											theItem.enclosure = [story.enclosure];
											}
										}
								//id
									if (story.id == undefined) {
										theItem.id = "";
										}
									else {
										theItem.id = utils.padWithZeros (story.id, 7);
										}
								if (++ctitems >= serverData.prefs.maxRiverItems) {
									flEndOfSource = true;
									break;
									}
								if (flSkipDuplicateTitles) { //5/29/14 by DW -- add the title to the titles object
									titles [reducedtitle] = true;
									}
								}
							}
						}
					doOneDay (utils.dateYesterday (theDay));
					}
				});
			}
		}
	doOneDay (starttime);
	}

var fsStats = {
	ctWrites: 0,
	ctBytesWritten: 0,
	ctWriteErrors: 0,
	ctReads: 0,
	ctBytesRead: 0,
	ctReadErrors: 0
	};



function fsSureFilePath (path, callback) { 
	var splits = path.split ("/");
	path = ""; //1/8/15 by DW
	if (splits.length > 0) {
		function doLevel (levelnum) {
			if (levelnum < (splits.length - 1)) {
				path += splits [levelnum] + "/";
				fs.exists (path, function (flExists) {
					if (flExists) {
						doLevel (levelnum + 1);
						}
					else {
						fs.mkdir (path, undefined, function () {
							doLevel (levelnum + 1);
							});
						}
					});
				}
			else {
				if (callback != undefined) {
					callback ();
					}
				}
			}
		doLevel (0);
		}
	else {
		if (callback != undefined) {
			callback ();
			}
		}
	}
function fsNewObject (path, data, type, acl, callback, metadata) {
	fsSureFilePath (path, function () {
		fs.writeFile (path, data, function (err) {
			var dataAboutWrite = {
				};
			if (err) {
				console.log ("fsNewObject: error == " + JSON.stringify (err, undefined, 4));
				fsStats.ctWriteErrors++;
				if (callback != undefined) {
					callback (err, dataAboutWrite);
					}
				}
			else {
				fsStats.ctWrites++;
				fsStats.ctBytesWritten += data.length;
				if (callback != undefined) {
					callback (err, dataAboutWrite);
					}
				}
			}); 
		});
	}
function fsGetObject (path, callback) {
	fs.readFile (path, "utf8", function (err, data) {
		var dataAboutRead = {
			Body: data
			};
		if (err) {
			fsStats.ctReadErrors++;
			}
		else {
			fsStats.ctReads++;
			fsStats.ctBytesRead += dataAboutRead.Body.length;
			}
		callback (err, dataAboutRead);
		});
	}
function fsListObjects (path, callback) {
	function endsWithChar (s, chPossibleEndchar) {
		if ((s === undefined) || (s.length == 0)) { 
			return (false);
			}
		else {
			return (s [s.length - 1] == chPossibleEndchar);
			}
		}
	fs.readdir (path, function (err, list) {
		if (!endsWithChar (path, "/")) {
			path += "/";
			}
		if (list !== undefined) { //6/4/15 by DW
			for (var i = 0; i < list.length; i++) {
				var obj = {
					s3path: path + list [i],
					path: path + list [i], //11/21/14 by DW
					Size: 1
					};
				callback (obj);
				}
			}
		callback ({flLastObject: true});
		});
	}
 
var localStorage = {
	};
var lastLocalStorageJson;

function loadLocalStorage (callback) {
	stGetObject (s3LocalStoragePath, function (error, data) {
		if (!error) {
			localStorage = parseJson (data.Body, s3LocalStoragePath);
			}
		if (callback != undefined) {
			callback ();
			}
		});
	}
function writeLocalStorageIfChanged () {
	var s = utils.jsonStringify (localStorage);
	if (s != lastLocalStorageJson) {
		lastLocalStorageJson = s;
		stNewObject (s3LocalStoragePath, s, "application/json", s3defaultAcl);
		}
	}


function runUserScript (s, dataforscripts, scriptName) {
	try {
		if (dataforscripts !== undefined) {
			with (dataforscripts) {
				eval (s);
				}
			}
		else {
			eval (s);
			}
		}
	catch (err) {
		console.log ("runUserScript: error running \"" + scriptName + "\" == " + err.message);
		}
	}
function runScriptsInFolder (path, dataforscripts, callback) {
	fsSureFilePath (path, function () {
		fs.readdir (path, function (err, list) {
			for (var i = 0; i < list.length; i++) {
				var fname = list [i];
				if (utils.endsWith (fname.toLowerCase (), ".js")) {
					var f = path + fname;
					fs.readFile (f, function (err, data) {
						if (err) {
							console.log ("runScriptsInFolder: error == " + err.message);
							}
						else {
							runUserScript (data.toString (), dataforscripts, f);
							}
						});
					}
				}
			if (callback != undefined) {
				callback ();
				}
			});
		});
	}
function callAddToRiverCallbacks (urlfeed, itemFromParser, itemFromRiver) {
	var dataforscripts = {
		urlfeed: urlfeed,
		itemFromParser: itemFromParser,
		itemFromRiver: itemFromRiver
		};
	runScriptsInFolder (addToRiverCallbacksFolder, dataforscripts, function () {
		});
	}



//storage routines -- 9/24/14 by DW
	function stNewObject (path, data, type, acl, callback, metadata) {
		if (fspath != undefined) {
			fsNewObject (path, data, type, acl, callback, metadata);
			}
		else {
			s3NewObject (path, data, type, acl, callback, metadata);
			}
		}
	function stGetObject (path, callback) {
		if (fspath != undefined) {
			fsGetObject (path, callback);
			}
		else {
			s3GetObject (path, callback);
			}
		}
	function stListObjects (path, callback) {
		if (fspath != undefined) {
			fsSureFilePath (path, function () { //7/19/15 by DW -- create the folder if it doesn't exist
				fsListObjects (path, callback);
				});
			}
		else {
			s3ListObjects (path, callback);
			}
		}

function todaysRiverChanged () { //6/21/15 by DW -- callback scripts, call this to be sure your changes get saved
	flRiverDirty = true;
	}
function httpReadUrl (url, callback) { //12/1/14 by DW
	request (url, function (error, response, body) {
		if (!error && (response.statusCode == 200)) {
			callback (body) 
			}
		else {
			callback (undefined);
			}
		});
	}
function parseJson (jsontext, s3Path) {
	var obj;
	try {
		return (JSON.parse (jsontext));
		}
	catch (err) {
		if (s3Path == undefined) {
			console.log ("parseJson, error: " + err.message);
			}
		else {
			console.log ("parseJson, error with S3 file: " + s3Path + ", " + err.message);
			}
		
		
		return (new Object ());
		}
	}
function countHttpSockets () {
	var ct = Object.keys (http.globalAgent.requests).length;
	if (ct == undefined) {
		ct = 0;
		}
	return (ct);
	}
function loadTodaysRiver (callback) {
	var s3path = getCalendarPath (dayRiverCovers);
	stGetObject (s3path, function (error, data) {
		if (!error) {
			todaysRiver = parseJson (data.Body, s3path);
			}
		if (callback != undefined) {
			callback ();
			}
		});
	}
function saveTodaysRiver (callback) {
	var now = new Date ();
	console.log ("saveTodaysRiver: " + getCalendarPath (dayRiverCovers));
	stNewObject (getCalendarPath (dayRiverCovers), utils.jsonStringify (todaysRiver, true), "application/json", s3defaultAcl, function (error, data) {
		serverData.stats.ctRiverSaves++;
		serverData.stats.whenLastRiverSave = now;
		if (error) { //4/21/15 by DW -- we were counting errors incorrectly
			serverData.stats.ctRiverSaveErrors++;
			serverData.stats.whenLastRiverSaveError = now;
			}
		else {
			flRiverDirty = false;
			}
		if (callback != undefined) {
			callback ();
			}
		});
	}
function checkRiverRollover () { 
	var now = new Date ();
	function roll () {
		todaysRiver = new Array (); //clear it out
		dayRiverCovers = now;
		serverData.stats.ctHitsToday = 0;
		saveTodaysRiver (); //4/21/15 by DW -- initialize empty river
		}
	if (utils.secondsSince (serverData.stats.whenLastStoryAdded) >= 60) {
		if (!utils.sameDay (now, dayRiverCovers)) { //rollover
			if (flRiverDirty) {
				saveTodaysRiver (roll);
				}
			else {
				roll ();
				}
			}
		}
	}
function addToRiver (urlfeed, itemFromParser, callback) {
	var now = new Date (), item = new Object ();
	//copy selected elements from the object from feedparser, into the item for the river
		function convertOutline (jstruct) { //7/16/14 by DW
			var theNewOutline = {}, atts, subs;
			if (jstruct ["source:outline"] != undefined) {
				if (jstruct ["@"] != undefined) {
					atts = jstruct ["@"];
					subs = jstruct ["source:outline"];
					}
				else {
					atts = jstruct ["source:outline"] ["@"];
					subs = jstruct ["source:outline"] ["source:outline"];
					}
				}
			else {
				atts = jstruct ["@"];
				subs = undefined;
				}
			for (var x in atts) {
				theNewOutline [x] = atts [x];
				}
			if (subs != undefined) {
				theNewOutline.subs = [];
				if (subs instanceof Array) {
					for (var i = 0; i < subs.length; i++) {
						theNewOutline.subs [i] = convertOutline (subs [i]);
						}
					}
				else {
					theNewOutline.subs = [];
					theNewOutline.subs [0] = {};
					for (var x in subs ["@"]) {
						theNewOutline.subs [0] [x] = subs ["@"] [x];
						}
					}
				}
			return (theNewOutline);
			}
		function newConvertOutline (jstruct) { //10/16/14 by DW
			var theNewOutline = {};
			if (jstruct ["@"] != undefined) {
				utils.copyScalars (jstruct ["@"], theNewOutline);
				}
			if (jstruct ["source:outline"] != undefined) {
				if (jstruct ["source:outline"] instanceof Array) {
					var theArray = jstruct ["source:outline"];
					theNewOutline.subs = [];
					for (var i = 0; i < theArray.length; i++) {
						theNewOutline.subs [theNewOutline.subs.length] = newConvertOutline (theArray [i]);
						}
					}
				else {
					theNewOutline.subs = [
						newConvertOutline (jstruct ["source:outline"])
						];
					}
				}
			return (theNewOutline);
			}
		function getString (s) {
			if (s == null) {
				s = "";
				}
			return (utils.stripMarkup (s));
			}
		function getDate (d) {
			if (d == null) {
				d = now;
				}
			return (new Date (d))
			}
		
		item.title = getString (itemFromParser.title);
		item.link = getString (itemFromParser.link);
		//description
			item.description = utils.trimWhitespace (getString (itemFromParser.description));
			if (item.description.length > serverData.prefs.maxBodyLength) {
				item.description = utils.trimWhitespace (utils.maxStringLength (item.description, serverData.prefs.maxBodyLength));
				}
		//permalink -- updated 5/30/14 by DW
			if (itemFromParser.permalink == undefined) {
				item.permalink = "";
				}
			else {
				item.permalink = itemFromParser.permalink;
				}
			
		//enclosure -- 5/30/14 by DW
			if (itemFromParser.enclosures != undefined) { //it's an array, we want the first one
				item.enclosure = itemFromParser.enclosures [0];
				}
		//source:outline -- 7/16/14 by DW
			if (itemFromParser ["source:outline"] != undefined) { //they're using a cool feature! :-)
				item.outline = newConvertOutline (itemFromParser ["source:outline"]);
				}
		item.pubdate = getDate (itemFromParser.pubDate);
		item.comments = getString (itemFromParser.comments);
		item.feedUrl = urlfeed;
		item.when = now; //6/7/15 by DW
		item.aggregator = myProductName + " v" + myVersion;
		item.id = serverData.stats.serialnum++; //5/28/14 by DW
	todaysRiver [todaysRiver.length] = item;
	flRiverDirty = true;
	//stats
		serverData.stats.ctStoriesAdded++;
		serverData.stats.ctStoriesAddedThisRun++;
		serverData.stats.whenLastStoryAdded = now;
		serverData.stats.lastStoryAdded = item;
	//show in console
		var consolemsg = itemFromParser.title;
		if (consolemsg == null) {
			consolemsg = utils.maxStringLength (utils.stripMarkup (itemFromParser.description), 80);
			}
		console.log ("***addToRiver: " + consolemsg);
	
	callAddToRiverCallbacks (urlfeed, itemFromParser, todaysRiver [todaysRiver.length - 1]); //6/19/15 by DW
	}

function loadServerData (callback) {
	stGetObject (s3PrefsAndStatsPath, function (error, data) {
		if (error) {
			if (!utils.beginsWith (error.message, "ENOENT")) { //7/19/15 by DW
				console.log ("loadServerData: error == " + error.message);
				}
			}
		else {
			var oldServerData = parseJson (data.Body, s3PrefsAndStatsPath);
			for (var x in oldServerData.prefs) { 
				serverData.prefs [x] = oldServerData.prefs [x];
				}
			for (var x in oldServerData.stats) { 
				serverData.stats [x] = oldServerData.stats [x];
				}
			serverData.lists = oldServerData.lists;
			serverData.flags = oldServerData.flags;
			}
		
		serverData.stats.aggregator = myProductName + " v" + myVersion;
		serverData.stats.whenServerStart = new Date ().toLocaleString ();
		serverData.stats.ctFeedReadsThisRun = 0;
		serverData.stats.ctStoriesAddedThisRun = 0;
		serverData.stats.ctHitsThisRun = 0;
		serverData.stats.ctServerStarts++;
		serverData.stats.ctActiveThreads = 0;
		
		flHaveServerData = true; //other code can depend on it being intialized
		
		if (callback != undefined) {
			callback ();
			}
		});
	}
function updateStatsBeforeSave () {
	var now = new Date ();
	
	//stats
		serverData.stats.ctHoursServerUp = utils.secondsSince (whenServerStart) / 3600; 
		serverData.stats.secsSinceLastFeedRead = utils.secondsSince (serverData.stats.whenLastFeedRead); 
		//set whenLastScanBegin and whenLastScanEnd
			if (serverData.stats.flScanningNow) {
				if (serverData.stats.secsSinceLastFeedRead > 15) {
					serverData.stats.ctScans++;
					serverData.stats.flScanningNow = false;
					serverData.stats.whenLastScanEnd = now;
					}
				}
			else {
				if (serverData.stats.secsSinceLastFeedRead < 5) {
					if (!serverData.stats.flScanningNow) {
						serverData.stats.flScanningNow = true;
						serverData.stats.whenLastScanBegin = now;
						}
					}
				}
	//s3 stats -- 5/30/14 by DW
		serverData.stats.s3stats = s3stats;
	//memory stats -- 5/30/14 by DW
		serverData.stats.memoryUsage = process.memoryUsage ();
	}
function saveServerData () {
	updateStatsBeforeSave ();
	stNewObject (s3PrefsAndStatsPath, utils.jsonStringify (serverData, true), "application/json", s3defaultAcl);
	}

function addToFeedsInLists (urlfeed) { //5/30/14 by DW
	if (feedsInLists [urlfeed] == undefined) {
		feedsInLists [urlfeed] = 1;
		}
	else {
		feedsInLists [urlfeed]++;
		}
	}
function saveFeedsInLists () { //5/30/14 by DW
	stNewObject (s3FeedsInListsPath, utils.jsonStringify (feedsInLists, true), "application/json", s3defaultAcl);
	}
function atLeastOneSubscriber (urlfeed) {
	return (feedsInLists [urlfeed] != undefined);
	}

function initFeedsArrayItem (feedstats) {
	if (feedstats.ctReads == undefined) {
		feedstats.ctReads = 0;
		}
	if (feedstats.whenLastRead == undefined) {
		feedstats.whenLastRead = new Date (0);
		}
	
	if (feedstats.ctItems == undefined) {
		feedstats.ctItems = 0;
		}
	if (feedstats.whenLastNewItem == undefined) {
		feedstats.whenLastNewItem = new Date (0);
		}
	
	if (feedstats.ctReadErrors == undefined) {
		feedstats.ctReadErrors = 0;
		}
	if (feedstats.whenLastReadError == undefined) {
		feedstats.whenLastReadError = new Date (0);
		}
	if (feedstats.ctConsecutiveReadErrors == undefined) {
		feedstats.ctConsecutiveReadErrors = 0;
		}
	
	if (feedstats.ctTimesChosen == undefined) {
		feedstats.ctTimesChosen = 0;
		}
	if (feedstats.whenLastChosenToRead == undefined) {
		feedstats.whenLastChosenToRead = new Date (0);
		}
	
	//init cloud stats -- 6/4/15 by DW
		if (feedstats.ctCloudRenew === undefined) { 
			feedstats.ctCloudRenew = 0;
			}
		if (feedstats.whenLastCloudRenew === undefined) {
			feedstats.whenLastCloudRenew = new Date (0);
			}
		if (feedstats.ctCloudRenewErrors === undefined) {
			feedstats.ctCloudRenewErrors = 0;
			}
		if (feedstats.ctConsecutiveCloudRenewErrors === undefined) {
			feedstats.ctConsecutiveCloudRenewErrors = 0;
			}
		if (feedstats.whenLastCloudRenewError === undefined) {
			feedstats.whenLastCloudRenewError = new Date (0);
			}
	}
function addToFeedsArray (urlfeed, obj, listname) {
	
	var lowerfeed = urlfeed.toLowerCase (), flfound = false, ixfeed;
	for (var i = 0; i < feedsArray.length; i++) {
		if (feedsArray [i].url.toLowerCase () == lowerfeed) {
			ixfeed = i;
			flfound = true;
			break;
			}
		}
	if (!flfound) {
		var objnew = new Object ();
		objnew.url = urlfeed;
		objnew.lists = [];
		ixfeed = feedsArray.length;
		feedsArray [ixfeed] = objnew;
		for (var x in obj) { //6/1/14 by DW -- moved into the if, only copy fields if the item is new
			feedsArray [ixfeed] [x] = obj [x];
			}
		}
	
	initFeedsArrayItem (obj);
	
	//add list name to the list of lists this feed belongs to
		var lists = feedsArray [ixfeed].lists, fladd = true;
		for (var i = 0; i < lists.length; i++) {
			if (lists [i] == listname) {
				fladd = false;
				}
			}
		if (fladd) {
			lists [lists.length] = listname;
			}
	
	flFeedsArrayDirty = true;
	}
function saveFeedsArray () {
	flFeedsArrayDirty = false;
	console.log ("saveFeedsArray: " + s3FeedsArrayPath);
	stNewObject (s3FeedsArrayPath, utils.jsonStringify (feedsArray, true), "application/json", s3defaultAcl);
	}
function loadFeedsArray (callback) {
	stGetObject (s3FeedsArrayPath, function (error, data) {
		if (!error) {
			feedsArray = parseJson (data.Body, s3FeedsArrayPath);
			for (var i = 0; i < feedsArray.length; i++) {
				initFeedsArrayItem (feedsArray [i]);
				}
			}
		if (callback != undefined) {
			callback ();
			}
		});
	}
function findInFeedsArray (urlfeed) {
	var lowerfeed = urlfeed.toLowerCase (), flfound = false, ixfeed;
	for (var i = 0; i < feedsArray.length; i++) {
		if (feedsArray [i].url.toLowerCase () == lowerfeed) {
			var feedstats = feedsArray [i];
			initFeedsArrayItem (feedstats);
			return (feedstats);
			}
		}
	return (undefined);
	}
function findNextFeedToRead () {
	var now = new Date (), whenLeastRecent = now, feedstats = feedsArray [0];
	
	function checkOne (ix) {
		if (atLeastOneSubscriber (feedsArray [ix].url)) {
			var d = feedsArray [ix].whenLastChosenToRead;
			if (d == undefined) { //newly subscribed, it moves to the head of the queue
				d = new Date (0);
				}
			else {
				d = new Date (d);
				}
			if (d < whenLeastRecent) {
				whenLeastRecent = d;
				feedstats = feedsArray [ix];
				}
			}
		}
	
	if (utils.random (0, 1) == 1) {
		for (var i = feedsArray.length - 1; i >= 0; i--) {
			checkOne (i);
			}
		}
	else {
		for (var i = 0; i < feedsArray.length; i++) {
			checkOne (i);
			}
		}
	
	if (feedstats == undefined) {
		return (undefined);
		}
	else {
		if (utils.secondsSince (feedstats.whenLastChosenToRead) < (serverData.prefs.ctMinutesBetwBuilds * 60)) { //not ready to read
			return (undefined);
			}
		else {
			initFeedsArrayItem (feedstats);
			feedstats.ctTimesChosen++;
			feedstats.whenLastChosenToRead = new Date ();
			flFeedsArrayDirty = true;
			return (feedstats);
			}
		}
	}

function getItemGuid (item) {
	function ok (val) {
		if (val != undefined) {
			if (val != "null") {
				return (true);
				}
			}
		return (false);
		}
	if (ok (item.guid)) {
		return (item.guid);
		}
	var guid = "";
	if (ok (item.pubDate)) {
		guid += item.pubDate;
		}
	if (ok (item.link)) {
		guid += item.link;
		}
	if (ok (item.title)) {
		guid += item.title;
		}
	if (guid.length > 0) {
		guid = md5 (guid);
		}
	return (guid);
	}
function initFeed (urlfeed, callback, flwrite) {
	function cleanFilenameForPlatform (s) { //11/1/14 by DW
		var flprocessed = false;
		if (fspath != undefined) { //we're running on the local file system
			switch (process.platform) { //11/1/14 by DW
				case "win32":
					s = utils.replaceAll (s, "/", "_");
					s = utils.replaceAll (s, "?", "_");
					s = utils.replaceAll (s, ":", "_");
					s = utils.replaceAll (s, "<", "_");
					s = utils.replaceAll (s, ">", "_");
					s = utils.replaceAll (s, "\"", "_");
					s = utils.replaceAll (s, "\\", "_");
					s = utils.replaceAll (s, "|", "_");
					s = utils.replaceAll (s, "*", "_");
					flprocessed = true;
					break;
				}
			}
		if (!flprocessed) {
			s = utils.replaceAll (s, "/", ":");
			}
		return (s);
		}
	function getFolderPath (urlfeed) { //return path to S3 folder for this feed
		var s = urlfeed;
		if (utils.beginsWith (s, "http://")) {
			s = utils.stringDelete (s, 1, 7);
			}
		else {
			if (utils.beginsWith (s, "https://")) {
				s = utils.stringDelete (s, 1, 8);
				}
			}
		s = cleanFilenameForPlatform (s); //11/1/14 by DW
		s = s3FeedsDataFolder + s + "/";
		return (s);
		}
	var folderpath = getFolderPath (urlfeed), infofilepath = folderpath + "feedInfo.json";
	var obj, starttime = new Date ();
	if (flwrite === undefined) {
		flwrite = false;
		}
	stGetObject (infofilepath, function (error, data) {
		if (error) {
			obj = new Object ();
			}
		else {
			obj = parseJson (data.Body, infofilepath);
			}
		
		//prefs
			if (obj.prefs == undefined) {
				obj.prefs = new Object ();
				}
			if (obj.prefs.enabled === undefined) {
				obj.prefs.enabled = true;
				}
			if (obj.prefs.url == undefined) {
				obj.prefs.url = urlfeed;
				}
			if (obj.prefs.ctSecsBetwRenews == undefined) {
				obj.prefs.ctSecsBetwRenews = 24 * 60 * 60; //24 hours
				}
			if (obj.prefs.flNonListSubscribe == undefined) {
				obj.prefs.flNonListSubscribe = false;
				}
		//data
			if (obj.data == undefined) {
				obj.data = new Object ();
				}
			if (obj.data.feedhash == undefined) {
				obj.data.feedhash = "";
				}
		//stats
			if (obj.stats == undefined) {
				obj.stats = new Object ();
				}
			if (obj.stats.s3MyPath == undefined) {
				obj.stats.s3MyPath = infofilepath;
				}
			if (obj.stats.s3FolderPath == undefined) {
				obj.stats.s3FolderPath = folderpath;
				}
			if (obj.stats.ctReads == undefined) {
				obj.stats.ctReads = 0;
				}
			if (obj.stats.ctReadErrors == undefined) {
				obj.stats.ctReadErrors = 0;
				}
			if (obj.stats.ctConsecutiveReadErrors == undefined) {
				obj.stats.ctConsecutiveReadErrors = 0;
				}
			if (obj.stats.whenLastReadError == undefined) {
				obj.stats.whenLastReadError = new Date (0);
				}
			if (obj.stats.lastReadError == undefined) {
				obj.stats.lastReadError = "";
				}
			if (obj.stats.ctItems == undefined) {
				obj.stats.ctItems = 0;
				}
			if (obj.stats.ctEnclosures == undefined) {
				obj.stats.ctEnclosures = 0;
				}
			if (obj.stats.whenLastRead == undefined) {
				obj.stats.whenLastRead = new Date (0);
				}
			if (obj.stats.whenLastNewItem == undefined) {
				obj.stats.whenLastNewItem = new Date (0);
				}
			if (obj.stats.whenSubscribed == undefined) {
				obj.stats.whenSubscribed = new Date ();
				}
			if (obj.stats.ctFeedTextChanges == undefined) {
				obj.stats.ctFeedTextChanges = 0;
				}
			if (obj.stats.ct304s == undefined) {
				obj.stats.ct304s = 0;
				}
			if (obj.stats.mostRecentPubDate == undefined) {
				obj.stats.mostRecentPubDate = new Date (0);
				}
			if (obj.stats.ctItemsTooOld == undefined) {
				obj.stats.ctItemsTooOld = 0;
				}
			if (obj.stats.ctReadsSkipped == undefined) {
				obj.stats.ctReadsSkipped = 0;
				}
		//feedInfo
			if (obj.feedInfo == undefined) {
				obj.feedInfo = new Object ();
				}
			if (obj.feedInfo.title == undefined) {
				obj.feedInfo.title = "";
				}
			if (obj.feedInfo.link == undefined) {
				obj.feedInfo.link = "";
				}
			if (obj.feedInfo.description == undefined) {
				obj.feedInfo.description = "";
				}
		//misc
			if (obj.history == undefined) {
				obj.history = new Array ();
				}
			if (obj.lists == undefined) {
				obj.lists = new Array ();
				}
			if (obj.calendar == undefined) {
				obj.calendar = new Object ();
				}
			
			obj.stats.secsLastInit = secsLastInit; //debugging
		
		if (callback != undefined) {
			callback (obj);
			}
		
		if (flwrite) {
			stNewObject (infofilepath, utils.jsonStringify (obj, true), "application/json", s3defaultAcl, function (error, data) {
				secsLastInit = utils.secondsSince (starttime);
				});
			}
		else {
			secsLastInit = utils.secondsSince (starttime);
			}
		});
	}
function saveFeed (feed, callback) {
	stNewObject (feed.stats.s3MyPath, utils.jsonStringify (feed, true), "application/json", s3defaultAcl, function (error, data) {
		if (callback !== undefined) { //6/5/15 by DW
			callback ();
			}
		});
	}
function readFeed (urlfeed, callback) {
	var starttime = new Date ();
	var itemsInFeed = new Object (); //6/3/15 by DW
	initFeed (urlfeed, function (feed) {
		if (feed.prefs.enabled) {
			var ctitemsthisfeed = 0, flfirstread = feed.stats.ctReads == 0, feedstats;
			feedstats = findInFeedsArray (urlfeed); //the in-memory feed stats, stuff the scanner uses to figure out which feed to read next
			//stats
				serverData.stats.ctFeedReads++;
				serverData.stats.ctFeedReadsLastHour++;
				serverData.stats.ctFeedReadsThisRun++;
				serverData.stats.lastFeedRead = urlfeed;
				serverData.stats.whenLastFeedRead = starttime;
				
				feed.stats.ctReads++;
				feed.stats.whenLastRead = starttime;
				
				feedstats.ctReads++;
				feedstats.whenLastRead = starttime;
				
				console.log ("readFeed: " + urlfeed);
				
				flFeedsArrayDirty = true;
			serverData.stats.ctActiveThreads++;
			if (utils.beginsWith (urlfeed, "feed://")) { //8/13/15 by DW
				urlfeed = "http://" + utils.stringDelete (urlfeed, 1, 7);
				}
			var req = request (urlfeed);
			var feedparser = new FeedParser ();
			req.on ("response", function (res) {
				var stream = this;
				serverData.stats.ctActiveThreads--;
				if (res.statusCode == 200) {
					stream.pipe (feedparser);
					}
				});
			req.on ("error", function (res) {
				feed.stats.ctReadErrors++;
				feed.stats.ctConsecutiveReadErrors++;
				feed.stats.whenLastReadError = starttime;
				
				feedstats.ctReadErrors++;
				feedstats.ctConsecutiveReadErrors++;
				feedstats.whenLastReadError = starttime;
				
				serverData.stats.ctActiveThreads--;
				});
			feedparser.on ("readable", function () {
				var item = this.read (), flnew;
				if (new Date (item.pubDate) > new Date (feed.stats.mostRecentPubDate)) {
					feed.stats.mostRecentPubDate = item.pubDate;
					feedstats.mostRecentPubDate = item.pubDate;
					}
				
				//set flnew -- do the history thing
					var theGuid = getItemGuid (item);
					itemsInFeed [theGuid] = true; //6/3/15 by DW
					flnew = true;
					for (var i = 0; i < feed.history.length; i++) {
						if (feed.history [i].guid == theGuid) { //we've already seen it
							flnew = false;
							break;
							}
						}
				if (flnew) { //add to the history array
					var obj = new Object (), flAddToRiver = true;
					obj.title = item.title; //helps with debugging
					obj.guid = theGuid;
					obj.when = starttime;
					feed.history [feed.history.length] = obj;
					
					//stats
						feed.stats.ctItems++;
						feed.stats.whenLastNewItem = starttime;
						
						feedstats.ctItems++;
						feedstats.whenLastNewItem = starttime;
						
					
					//copy feed info from item into the feed record -- 6/1/14 by DW
						feed.feedInfo.title = item.meta.title;
						feed.feedInfo.link = item.meta.link;
						feed.feedInfo.description = item.meta.description;
					//copy cloud info, if present -- 6/3/15 by DW
						if (item.meta.cloud !== undefined) {
							if (item.meta.cloud.domain !== undefined) {
								feed.feedInfo.cloud = {
									domain: item.meta.cloud.domain,
									port: item.meta.cloud.port,
									path: item.meta.cloud.path,
									port: item.meta.cloud.port,
									registerProcedure: item.meta.cloud.registerprocedure,
									protocol: item.meta.cloud.protocol
									};
								feedstats.cloud = {
									domain: item.meta.cloud.domain,
									port: item.meta.cloud.port,
									path: item.meta.cloud.path,
									port: item.meta.cloud.port,
									registerProcedure: item.meta.cloud.registerprocedure,
									protocol: item.meta.cloud.protocol,
									};
								}
							}
					//copy feeds info from item into feeds in-memory array element -- 6/1/14 by DW
						feedstats.title = item.meta.title;
						feedstats.text = item.meta.title;
						feedstats.htmlurl = item.meta.link;
						feedstats.description = item.meta.description;
						flFeedsArrayDirty = true;
					
					//exclude items that newly appear in feed but have a too-old pubdate
						if ((item.pubDate != null) && (new Date (item.pubDate) < utils.dateYesterday (feed.stats.mostRecentPubDate)) && (!flfirstread)) { 
							flAddToRiver = false;
							feed.stats.ctItemsTooOld++;
							feed.stats.whenLastTooOldItem = starttime;
							}
					if ((flAddToRiver) && (!flfirstread)) {
						addToRiver (urlfeed, item);
						}
					}
				
				if (serverData.prefs.flWriteItemsToFiles) { //debugging
					var path = feed.stats.s3FolderPath + "items/" + utils.padWithZeros (ctitemsthisfeed++, 3) + ".json";
					stNewObject (path, utils.jsonStringify (item, true), "application/json", s3defaultAcl);
					}
				});
			feedparser.on ("end", function () {
				//delete items in the history array that are no longer in the feed -- 6/3/15 by DW
					var ctHistoryItemsDeleted = 0;
					for (var i = feed.history.length - 1; i >= 0; i--) { //6/3/15 by DW
						if (itemsInFeed [feed.history [i].guid] === undefined) { //it's no longer in the feed
							feed.history.splice (i, 1);
							ctHistoryItemsDeleted++;
							}
						}
					if (ctHistoryItemsDeleted > 0) {
						console.log ("readFeed: ctHistoryItemsDeleted == " + ctHistoryItemsDeleted);
						}
					
				feed.stats.ctSecsLastRead = utils.secondsSince (starttime);
				saveFeed (feed, function () {
					if (callback !== undefined) { //6/5/15 by DW
						callback ();
						}
					});
				});
			feedparser.on ("error", function () {
				feed.stats.ctReadErrors++;
				feed.stats.ctConsecutiveReadErrors++;
				feed.stats.whenLastReadError = starttime;
				});
			}
		});
	}

function readIncludedList (listname, urloutline) { //6/17/14 by DW
	var req = request (urloutline);
	var opmlparser = new OpmlParser ();
	
	console.log ("readIncludedList: listname == " + listname + ", urloutline == " + urloutline);
	
	req.on ("response", function (res) {
		var stream = this;
		if (res.statusCode == 200) {
			stream.pipe (opmlparser);
			}
		});
	req.on ("error", function (res) {
		});
	opmlparser.on ("error", function (error) {
		console.log ("readIncludedList: opml parser error == " + error.message);
		});
	opmlparser.on ("readable", function () {
		var outline;
		while (outline = this.read ()) {
			var type = outline ["#type"];
			if (type == "feed") {
				if ((outline.xmlurl != undefined) && (outline.xmlurl.length > 0)) { //6/9/14 by DW
					addToFeedsArray (outline.xmlurl, outline, listname); 
					addToFeedsInLists (outline.xmlurl); //5/30/14 by DW
					}
				}
			}
		});
	opmlparser.on ("end", function () {
		});
	}
function readOneList (listname, filepath) {
	console.log ("readOneList: listname == " + listname + ", filepath == " + filepath);
	var opmlparser = new OpmlParser ();
	opmlparser.on ("error", function (error) {
		console.log ("scanner: opml parser error == " + error.message);
		});
	opmlparser.once ("readable", function () {
		});
	opmlparser.on ("readable", function () {
		var outline;
		while (outline = this.read ()) {
			var type = outline ["#type"];
			
			if (type == "feed") {
				if ((outline.xmlurl != undefined) && (outline.xmlurl.length > 0)) { //6/9/14 by DW
					addToFeedsArray (outline.xmlurl, outline, listname); 
					addToFeedsInLists (outline.xmlurl); //5/30/14 by DW
					}
				}
			else { //6/17/14 by DW
				if (outline.type != undefined) {
					if (outline.type == "include") {
						qAddTask ("readIncludedList (\"" + listname + "\", \"" + outline.url + "\")");
						}
					}
				}
			}
		});
	opmlparser.on ("end", function () {
		});
	stGetObject (filepath, function (error, data) {
		if (error) {
			console.log ("readOneList: error == " + error.message);
			}
		else {
			opmlparser.end (data.Body.toString ());
			}
		});
	}
function initList (name, callback) {
	var foldername = name, infofilepath;
	if (utils.endsWith (foldername, ".opml")) {
		foldername = utils.stringDelete (foldername, foldername.length - 4, 5);
		}
	infofilepath = s3ListsDataFolder + foldername + "/listInfo.json";
	stGetObject (infofilepath, function (error, data) {
		if (error) {
			obj = new Object ();
			}
		else {
			obj = parseJson (data.Body, infofilepath);
			}
		
		//prefs
			if (obj.prefs == undefined) {
				obj.prefs = new Object ();
				}
			if (obj.prefs.enabled == undefined) {
				obj.prefs.enabled = true;
				}
		//stats
			if (obj.stats == undefined) {
				obj.stats = new Object ();
				}
			if (obj.stats.ctReads == undefined) {
				obj.stats.ctReads = 0;
				}
			if (obj.stats.whenLastRead == undefined) {
				obj.stats.whenLastRead = new Date (0);
				}
			if (obj.stats.whenSubscribed == undefined) {
				obj.stats.whenSubscribed = new Date ();
				}
			if (obj.stats.ctBlockedItems == undefined) {
				obj.stats.ctBlockedItems = 0;
				}
		//listInfo
			if (obj.listInfo == undefined) {
				obj.listInfo = new Object ();
				}
			if (obj.listInfo.title == undefined) {
				obj.listInfo.title = "";
				}
		//misc
			if (obj.feeds == undefined) {
				obj.feeds = new Array ();
				}
			if (obj.feedsBlocked == undefined) {
				obj.feedsBlocked = new Array ();
				}
			if (obj.calendar == undefined) {
				obj.calendar = new Object ();
				}
			if (obj.river == undefined) {
				obj.river = new Object ();
				}
		
		if (callback != undefined) {
			callback (obj);
			}
		
		stNewObject (infofilepath, utils.jsonStringify (obj, true), "application/json", s3defaultAcl, function (error, data) {
			});
		});
	}
function loadListsFromFolder () {
	var now = new Date ();
	for (var i = 0; i < feedsArray.length; i++) { //6/7/14 by DW
		feedsArray [i].lists = [];
		}
	serverData.stats.ctListFolderReads++;
	serverData.stats.whenLastListFolderRead = now;
	serverData.stats.listNames = new Array ();
	feedsInLists = new Object ();
	stListObjects (s3UserListsPath, function (obj) { //read user's list files
		if (obj.flLastObject != undefined) {
			}
		else {
			if (obj.Size > 0) { //it's a file
				var filepath = obj.s3path;
				var listname = utils.stringNthField (filepath, "/", utils.stringCountFields (filepath, "/")); //something like myList.opml
				if (utils.endsWith (listname, ".opml")) { //11/1/14 by DW
					serverData.stats.listNames [serverData.stats.listNames.length] = listname; //5/28/14 by DW
					initList (listname, function () {
						qAddTask ("readOneList (\"" + listname + "\", \"" + filepath + "\")");
						});
					}
				}
			}
		});
	}
	
function getAllLists (callback) {
	var theLists = new Array ();
	function getOneFile (ix) {
		if (ix >= serverData.stats.listNames.length) {
			callback (theLists);
			}
		else {
			var fname = serverData.stats.listNames [ix], f = s3UserListsPath + fname;
			stGetObject (f, function (error, data) {
				if (error) {
					console.log ("getAllLists: error reading list " + fname + " error == " + error.message);
					}
				else {
					theLists [theLists.length] = {
						listname: fname,
						opmltext: data.Body.toString ()
						};
					}
				getOneFile (ix + 1);
				});
			}
		}
	getOneFile (0);
	}
function getOneFeed (urlfeed, callback) { //11/26/14 by DW
	initFeed (urlfeed, function (feed) {
		callback (feed);
		});
	}
function getOneRiver (fname, callback) { //11/28/14 by DW
	var name = utils.stringPopLastField (fname, "."); //get rid of .opml extension if present
	var path = s3UserRiversPath + name + ".js";
	stGetObject (path, function (error, data) {
		var s;
		if (error) {
			s = "";
			console.log ("getOneRiver: error == " + utils.jsonStringify (error));
			}
		else {
			s = data.Body.toString ();
			}
		if (callback != undefined) {
			callback (s);
			}
		});
	}
function getFeedMetadata (url, callback) { //12/1/14 by DW
	var req = request (url), feedparser = new FeedParser ();
	req.on ("response", function (res) {
		var stream = this;
		if (res.statusCode == 200) {
			stream.pipe (feedparser);
			}
		else {
			callback (undefined);
			}
		});
	req.on ("error", function (res) {
		callback (undefined);
		});
	feedparser.on ("readable", function () {
		var item = this.read ();
		callback (item.meta);    
		});
	feedparser.on ("end", function () {
		callback (undefined);
		});
	feedparser.on ("error", function () {
		callback (undefined);
		});
	}
function saveSubscriptionList (listname, xmltext) { //12/1/14 by DW
	var path = s3UserListsPath + listname, now = new Date ();
	stNewObject (path, xmltext, "text/xml", s3defaultAcl, function (error, data) {
		var serialnum = utils.padWithZeros (++serverData.stats.backupSerialnum, 3);
		var fname = utils.stringPopLastField (listname, ".") + serialnum + ".opml"; //something like movies024.opml
		var backuppath = s3BackupsFolder + utils.getDatePath (undefined, true) + fname;
		stNewObject (backuppath, xmltext, "text/xml", s3defaultAcl, function (error, data) {
			serverData.stats.ctListSaves++;
			serverData.stats.whenLastListSave = now; 
			readOneList (listname, path);
			});
		});
	}

function pleaseNotify (urlServer, domain, port, path, urlFeed, feedstats, callback) { //6/4/15 by DW
	var now = new Date ();
	var theRequest = {
		url: urlServer,
		followRedirect: true, 
		headers: {Accept: "application/json"},
		method: "POST",
		form: {
			port: port,
			path: path,
			url1: urlFeed,
			protocol: "http-post"
			}
		};
	request (theRequest, function (error, response, body) {
		try {
			if (!error && (response.statusCode == 200)) {
				feedstats.ctConsecutiveCloudRenewErrors = 0;
				if (callback) {
					callback ();
					}
				}
			else {
				console.log ("pleaseNotify: urlServer == " + urlServer + ", error, code == " + response.statusCode + ".\n");
				feedstats.ctCloudRenewErrors++; //counts the number of communication errors
				feedstats.ctConsecutiveCloudRenewErrors++;
				feedstats.whenLastCloudRenewError = now;
				}
			}
		catch (err) {
			console.log ("pleaseNotify: urlServer == " + urlServer + ", err.message == " + err.message);
			feedstats.ctCloudRenewErrors++; //counts the number of communication errors
			feedstats.ctConsecutiveCloudRenewErrors++;
			feedstats.whenLastCloudRenewError = now;
			}
		feedstats.ctCloudRenew++;
		feedstats.whenLastCloudRenew = now;
		flFeedsArrayDirty = true; //because we modified feedstats
		});
	}
function renewNextSubscription () { //6/4/15 by DW
	if (serverData.prefs.flRequestCloudNotify) {
		var theFeed;
		for (var i = 0; i < feedsArray.length; i++) {
			theFeed = feedsArray [i];
			if (theFeed.cloud !== undefined) {
				if (utils.secondsSince (theFeed.whenLastCloudRenew) > (23 * 60 * 60)) { //ready to be renewed
					var urlCloudServer = "http://" + theFeed.cloud.domain + ":" + theFeed.cloud.port + theFeed.cloud.path;
					pleaseNotify (urlCloudServer, undefined, myPort, "/feedupdated", theFeed.url, theFeed, function () {
						console.log ("renewNextSubscription: urlCloudServer == " + urlCloudServer);
						});
					return; //we renew at most one each time we're called
					}
				}
			}
		}
	}
function rssCloudFeedUpdated (urlFeed) { //6/4/15 by DW
	var feedstats = findInFeedsArray (urlFeed);
	if (feedstats === undefined) {
		console.log ("\nrssCloudFeedUpdated: url == " + urlFeed + ", but we're not subscribed to this feed, so it wasn't read.\n");
		}
	else {
		var now = new Date ();
		serverData.stats.whenLastRssCloudUpdate = now;
		serverData.stats.ctRssCloudUpdates++;
		console.log ("\nrssCloudFeedUpdated: url == " + urlFeed + ", now == " + now.toLocaleString ());
		readFeed (urlFeed, function () {
			for (var i = 0; i < feedstats.lists.length; i++) {
				var listname = "\"" + feedstats.lists [i] + "\"";
				var flskip = serverData.prefs.flSkipDuplicateTitles;
				var s = "buildOneRiver (" + listname + ", true, " + flskip + ", true);";
				console.log ("rssCloudFeedUpdated: " + s);
				qAddTask (s);
				}
			});
		}
	}

function applyPrefs () {
	http.globalAgent.maxSockets = serverData.prefs.maxThreads * 5;
	https.globalAgent.maxSockets = serverData.prefs.maxThreads * 5;
	}
function copyIndexFile () { //6/1/14 by DW
	if (serverData.prefs.enabled) {
		stGetObject (s3IndexFile, function (error, data) {
			if (error) {
				request (urlIndexSource, function (error, response, htmltext) {
					if (!error && response.statusCode == 200) {
						stNewObject (s3IndexFile, htmltext, "text/html", s3defaultAcl, function (error, data) {
							});
						}
					});
				}
			});
		}
	}
function buildRiversArray () { //6/1/14 by DW -- build a data structure used by the river browser
	var riversArray = new Array ();
	for (var i = 0; i < serverData.stats.listNames.length; i++) {
		var obj = new Object (), rivername = utils.stringPopLastField (serverData.stats.listNames [i], ".");
		obj.url = "rivers/" + rivername + ".js"; //designed for an app running at the top level of the bucket
		obj.title = rivername;
		obj.longTitle =  rivername;
		obj.description = "";
		riversArray [i] = obj;
		}
	stNewObject (s3RiversArrayPath, utils.jsonStringify (riversArray, true), "application/json", s3defaultAcl, function (error, data) {
		console.log ("buildRiversArray: " + s3RiversArrayPath);
		});
	}
function buildAllRivers () { //queue up tasks to build each of the river.js files
	for (var i = 0; i < serverData.stats.listNames.length; i++) { 
		var listname = "\"" + serverData.stats.listNames [i] + "\"";
		var flskip = serverData.prefs.flSkipDuplicateTitles;
		var s = "buildOneRiver (" + listname + ", true, " + flskip + ", true);";
		qAddTask (s);
		}
	whenLastRiversBuild = new Date (); //8/6/14 by DW
	}
function getAppModDate (callback) { //8/21/15 by DW
	fs.exists (fnameApp, function (flExists) {
		if (flExists) {
			fs.stat (fnameApp, function (err, stats) {
				if (err) {
					callback (undefined);
					}
				else {
					callback (new Date (stats.mtime).toString ());
					}
				});
			}
		else {
			callback (undefined);
			}
		});
	}
function everyQuarterSecond () {
	if (serverData.prefs.enabled) {
		if (countHttpSockets () < serverData.prefs.maxThreads) {
			qRunNextTask ();
			}
		}
	}
function everyFiveMinutes () {
	if (serverData.prefs.enabled) {
		buildAllRivers ();
		buildRiversArray ();
		}
	}
function everyMinute () {
	try {
		var now = new Date (), enabledMessage = "";
		serverData.stats.ctHttpSockets = countHttpSockets (); 
		serverData.stats.ctMinutes++;
		
		renewNextSubscription (); //6/4/15 by DW
		writeLocalStorageIfChanged (); //6/20/15 by DW
		
		if (!serverData.prefs.enabled) { //12/4/14 by DW
			enabledMessage = " server is not enabled.";
			}
		
		console.log ("\neveryMinute: " + now.toLocaleTimeString () + ", " + qSize () + " items on the task queue, " + serverData.stats.ctHttpSockets  + " sockets open, " + feedsArray.length + " feeds." + enabledMessage + " v" + myVersion);
		
		clearBuildRiverCache ();
		
		if (serverData.prefs.enabled) {
			if (flHaveServerData) {
				//check for hour rollover
					if (now.getHours () != whenLastEveryMinute.getHours ()) {
						serverData.stats.ctFeedReadsLastHour = 0;
						}
					whenLastEveryMinute = now;
				saveServerData ();
				
				if (flRiverDirty) {
					saveTodaysRiver ();
					}
				checkRiverRollover ();
				
				if (flFeedsArrayDirty) {
					saveFeedsArray ();
					}
				if (flFeedsInListsDirty) {
					saveFeedsInLists ();
					flFeedsInListsDirty = false;
					}
				
				if (utils.secondsSince (whenLastRiversBuild) >= 59) { //8/6/14 by DW
					loadListsFromFolder ();
					flFeedsInListsDirty = true;
					}
				}
			}
		}
	catch (err) {
		console.log ("everyMinute, error == " + err.message);
		}
	}
function everySecond () {
	if (!flScheduledEveryMinute) { //8/22/15 by DW
		if (new Date ().getSeconds () == 0) {
			setInterval (everyMinute, 60000); 
			setInterval (everyFiveMinutes, 300000); 
			flScheduledEveryMinute = true;
			everyMinute (); //it's the top of the minute, we have to do one now
			}
		}
	if (flWatchAppDateChange) { //8/21/15 by DW
		getAppModDate (function (theModDate) {
			if (theModDate != origAppModDate) {
				console.log ("everySecond: " + fnameApp + " has been updated. " + myProductName + " is quitting now.");
				process.exit (0);
				}
			});
		}
	if (serverData.prefs.enabled) {
		var ct = serverData.prefs.ctReadsPerSecond;
		for (var i = 0; i < ct; i++) {
			if (countHttpSockets () <= serverData.prefs.maxThreads) {
				var feedstats = findNextFeedToRead ();
				if (feedstats !== undefined) { //a feed is ready to read
					readFeed (feedstats.url);
					}
				} 
			}
		}
	}

function handleRequest (httpRequest, httpResponse) {
	function writeHead (type) {
		if (type == undefined) {
			type = "text/plain";
			}
		httpResponse.writeHead (200, {"Content-Type": type, "Access-Control-Allow-Origin": "*"});
		}
	function respondWithObject (obj) {
		writeHead ("application/json");
		httpResponse.end (utils.jsonStringify (obj));    
		}
	try {
		var parsedUrl = urlpack.parse (httpRequest.url, true), now = new Date (), startTime = now;
		var lowerpath = parsedUrl.pathname.toLowerCase (), host, port = 80, flLocalRequest = false;
		
		//set host, port, flLocalRequest
			host = httpRequest.headers.host;
			if (utils.stringContains (host, ":")) {
				port = utils.stringNthField (host, ":", 2);
				host = utils.stringNthField (host, ":", 1);
				}
			flLocalRequest = utils.beginsWith (host, "localhost");
		//show the request on the console
			var localstring = "";
			if (flLocalRequest) {
				localstring = "* ";
				}
			console.log (localstring + httpRequest.method + " " + host + ":" + port + " " + lowerpath);
		
		//stats
			serverData.stats.ctHits++;
			serverData.stats.ctHitsToday++;
			serverData.stats.ctHitsThisRun++;
		switch (httpRequest.method) {
			case "GET":
				switch (lowerpath) {
					case "/": //7/4/15 by DW
						httpResponse.writeHead (200, {"Content-Type": "text/html"});
						request (urlServerHomePageSource, function (error, response, htmltext) {
							if (!error && response.statusCode == 200) {
								httpResponse.end (htmltext);    
								}
							});
						break;
					case "/version":
						httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
						httpResponse.end (myVersion);    
						break;
					case "/now":
						httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
						httpResponse.end (now.toString ());    
						break;
					case "/status": 
						var myStatus = {
							version: myVersion, 
							now: now.toUTCString (), 
							whenServerStart: whenServerStart.toUTCString (), 
							s3Path: s3path, //7/31/14 by DW
							port: myPort, //7/31/14 by DW
							defaultAcl: s3defaultAcl, //7/31/14 by DW
							hits: serverData.stats.ctHits, 
							hitsToday: serverData.stats.ctHitsToday,
							hitsThisRun: serverData.stats.ctHitsThisRun
							};
						httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
						httpResponse.end (utils.jsonStringify (myStatus, true));    
						break;
					case "/serverdata":
						updateStatsBeforeSave ();
						httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
						httpResponse.end (utils.jsonStringify (serverData.stats, true));    
						break;
					case "/feedstats":
						httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
						httpResponse.end (utils.jsonStringify (feedsArray, true));    
						break;
					case "/buildallrivers":
						httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
						if (serverData.prefs.enabled) {
							buildAllRivers ();
							httpResponse.end ("Your rivers are building sir or madam.");    
							}
						else {
							httpResponse.end ("Can't build the rivers because serverData.prefs.enabled is false.");    
							}
						break;
					case "/loadlists":
						loadListsFromFolder ();
						httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
						httpResponse.end ("We're reading the lists, right now, as we speak.");    
					case "/dashboard": //6/2/14 by DW
						httpResponse.writeHead (200, {"Content-Type": "text/html"});
						request (urlDashboardSource, function (error, response, htmltext) {
							if (!error && response.statusCode == 200) {
								httpResponse.end (htmltext);    
								}
							});
						break;
					case "/ping": //9/11/14 by DW
						var url = parsedUrl.query.url;
						httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
						if (findInFeedsArray (url) == undefined) {
							httpResponse.end ("Ping received, but we're not following this feed. Sorry.");    
							}
						else {
							httpResponse.end ("Ping received, will read asap.");    
							readFeed (url);
							}
						break;
					case "/getlistnames": //11/11/14 by DW
						httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
						httpResponse.end (utils.jsonStringify (serverData.stats.listNames));    
						break;
					case "/getalllists": //11/11/14 by DW
						httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
						getAllLists (function (theLists) {
							httpResponse.end (utils.jsonStringify (theLists));    
							});
						break;
					case "/getonefeed": //11/26/14 by DW
						var url = parsedUrl.query.url;
						httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
						getOneFeed (url, function (theFeed) {
							httpResponse.end (utils.jsonStringify (theFeed));    
							});
						break;
					case "/getoneriver": //11/28/14 by DW 
						httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
						getOneRiver (parsedUrl.query.fname, function (s) {
							httpResponse.end (s);    
							});
						break;
					case "/getfeedmeta": //12/1/14 by DW -- for the list editor, just get the metadata about the feed
						httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
						getFeedMetadata (parsedUrl.query.url, function (data) {
							if (data == undefined) {
								httpResponse.end ("");    
								}
							else {
								httpResponse.end (utils.jsonStringify (data));    
								}
							});
						break;
					case "/readfile": //12/1/14 by DW
						httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
						httpReadUrl (parsedUrl.query.url, function (s) {
							if (s == undefined) {
								httpResponse.end ("");    
								}
							else {
								httpResponse.end (s);    
								}
							});
						break;
					case "/getprefs": //12/1/14 by DW
						respondWithObject (serverData.prefs);
						break;
					case "/feedupdated": //6/4/15 by DW
						var challenge = parsedUrl.query.challenge;
						console.log ("/feedupdated: challenge == " + challenge);
						httpResponse.writeHead (200, {"Content-Type": "text/plain"});
						httpResponse.end (challenge);    
						break;
					case "/favicon.ico": //7/19/15 by DW
						httpResponse.writeHead (302, {"location": urlFavicon, "Content-Type": "text/plain"});
						httpResponse.end ("302 REDIRECT");    
						break;
					default: //404 not found
						httpResponse.writeHead (404, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
						httpResponse.end ("\"" + lowerpath + "\" is not one of the endpoints defined by this server.");
					}
				break;
			case "POST": //12/2/14 by DW
				var body = "";
				httpRequest.on ("data", function (data) {
					body += data;
					});
				httpRequest.on ("end", function () {
					var flPostAllowed = false;
					
					//set flPostAllowed -- 12/4/14 by DW
						if (flLocalRequest) {
							flPostAllowed = true;
							}
						else {
							if (lowerpath == "/feedupdated") {
								flPostAllowed = true;
								}
							else {
								if (remotePassword.length > 0) { //must have password set
									flPostAllowed = (parsedUrl.query.password === remotePassword);
									}
								}
							}
					if (flPostAllowed) {
						console.log ("POST body length: " + body.length);
						switch (lowerpath) {
							case "/setprefs": 
								var newprefs = JSON.parse (body);
								for (var x in newprefs) {
									serverData.prefs [x] = newprefs [x];
									}
								saveServerData ();
								respondWithObject ({});
								break;
							case "/savelist": 
								httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
								saveSubscriptionList (parsedUrl.query.listname, body);
								httpResponse.end ("");    
								break;
							case "/feedupdated": //6/4/15 by DW
								var postbody = qs.parse (body);
								rssCloudFeedUpdated (postbody.url);
								httpResponse.writeHead (200, {"Content-Type": "text/plain"});
								httpResponse.end ("Thanks for the update! :-)");    
								break;
							default: //404 not found
								httpResponse.writeHead (404, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
								httpResponse.end ("\"" + lowerpath + "\" is not one of the endpoints defined by this server.");
							}
						}
					else {
						httpResponse.writeHead (403, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
						httpResponse.end ("This feature can only be accessed locally.");    
						}
					});
				break;
			}
		}
	catch (tryError) {
		httpResponse.writeHead (503, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
		httpResponse.end (tryError.message);    
		}
	}

function loadConfig (callback) { //5/9/15 by DW
	fs.readFile (fnameConfig, function (err, data) {
		if (!err) {
			var config = JSON.parse (data.toString ());
			if (config.enabled !== undefined) {
				flEnabled = utils.getBoolean (config.enabled);
				}
			if (config.fspath !== undefined) {
				fspath = config.fspath;
				}
			if (config.password !== undefined) {
				remotePassword = config.password;
				}
			if (config.s3path !== undefined) {
				s3path = config.s3path;
				}
			if (config.PORT !== undefined) {
				myPort = config.PORT;
				}
			
			if (config.flWatchAppDateChange !== undefined) { //8/21/15 by DW
				flWatchAppDateChange = utils.getBoolean (config.flWatchAppDateChange);
				}
			if (config.fnameApp !== undefined) { //8/21/15 by DW
				fnameApp = config.fnameApp;
				}
			
			if (config.s3defaultAcl !== s3defaultAcl) {
				s3defaultAcl = config.s3defaultAcl;
				}
			appConfig = config; //6/4/15 by DW
			}
		if (callback !== undefined) {
			callback ();
			}
		});
	}

function startup () {
	if (process.env.s3defaultAcl !== undefined) { //7/19/14 by DW
		s3defaultAcl = process.env.s3defaultAcl;
		}
	loadConfig (function () {
		if ((s3path === undefined) && (fspath === undefined)) { //7/19/15 by DW
			fspath = "river4data/";
			}
		if (fspath !== undefined) { //9/24/14 by DW
			s3path = fspath; 
			}
		//display startup message
			var pathmsg = (fspath === undefined) ? ("s3 path == " + s3path) : ("file path == " + fspath);
			console.log ("\n" + myProductName + " v" + myVersion + " running on port " + myPort + ", " + pathmsg);
		if (remotePassword === undefined) { //12/4/14 by DW
			remotePassword = "";
			}
		s3UserListsPath = s3path + "lists/"; //where users store their lists
		s3UserRiversPath = s3path + "rivers/"; //where we store their rivers
		s3PrefsAndStatsPath = s3path + "data/prefsAndStats.json";
		s3LocalStoragePath = s3path + "data/localStorage.json"; //6/22/15 by DW
		s3FeedsArrayPath = s3path + "data/feedsStats.json";
		s3RiversArrayPath = s3path + "data/riversArray.json";
		s3FeedsInListsPath = s3path + "data/feedsInLists.json";
		s3FeedsDataFolder = s3path + "data/feeds/";
		s3CalendarDataFolder = s3path + "data/calendar/";
		s3BackupsFolder = s3path + "data/backups/"; //12/4/14 by DW
		s3ListsDataFolder = s3path + "data/lists/";
		s3IndexFile = s3path + "index.html";
		
		getAppModDate (function (appModDate) { //set origAppModDate -- 8/21/15 by DW
			origAppModDate = appModDate;
			loadServerData (function () {
				applyPrefs ();
				
				
				saveServerData (); //so hours-server-up stats update immediately
				
				loadFeedsArray (function () {
					loadLocalStorage (function () { //6/20/15 by DW
						loadTodaysRiver (function () {
							loadListsFromFolder (); //adds tasks to the queue
							//make sure all the top level folders are created -- 7/19/15 by DW
								if (fspath !== undefined) {
									fsSureFilePath (s3UserRiversPath, function () {
										fsSureFilePath (s3UserListsPath, function () {
											});
										});
									}
							http.createServer (handleRequest).listen (myPort);
							setInterval (everyQuarterSecond, 250);
							setInterval (everySecond, 1000); 
							everyMinute (); //do one immediately on startup
							});
						});
					});
				});
			});
		});
	}

startup ();
