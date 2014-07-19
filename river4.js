var myVersion = "0.90", myProductName = "River4", flRunningOnServer = true;


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
    
var s3path = process.env.s3path; 
var s3UserListsPath = s3path + "lists/"; //where users store their lists
var s3UserRiversPath = s3path + "rivers/"; //where we store their rivers
var s3PrefsAndStatsPath = s3path + "data/prefsAndStats.json";
var s3FeedsArrayPath = s3path + "data/feedsStats.json";
var s3RiversArrayPath = s3path + "data/riversArray.json";
var s3FeedsInListsPath = s3path + "data/feedsInLists.json";
var s3FeedsDataFolder = s3path + "data/feeds/";
var s3CalendarDataFolder = s3path + "data/calendar/";
var s3ListsDataFolder = s3path + "data/lists/";
var s3IndexFile = s3path + "index.html";

var urlIndexSource = "http://fargo.io/code/river4/river4homepage.html";
var urlDashboardSource = "http://fargo.io/code/river4/dashboard.html";

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
		flWriteItemsToFiles: false //debugging -- 5/30/14 by DW
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
		whenLastRiverJsonSave: new Date (0)
		},
	flags: []
	}
var flHaveServerData = false; 

var feedsArray = [], flFeedsArrayDirty = false;

var feedsInLists = {}, flFeedsInListsDirty = false; //5/30/14 by DW

var todaysRiver = [], dayRiverCovers = new Date (), flRiverDirty = false;

var whenLastEveryMinute = new Date ();



 

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
function s3NewObject (path, data, type, acl, callback) {
	var splitpath = s3SplitPath (path);
	if (type == undefined) {
		type = s3defaultType;
		}
	if (acl == undefined) {
		acl = s3defaultAcl;
		}
	var params = {
		ACL: acl,
		ContentType: type,
		Body: data,
		Bucket: splitpath.Bucket,
		Key: splitpath.Key
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
			consoleLog ("s3Redirect: err.message = " + err.message + ".");
			}
		else {
			consoleLog ("s3Redirect: path = " + path + ", url = " + url + ", data = ", JSON.stringify (data));
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





function sameDay (d1, d2) { 
	//returns true if the two dates are on the same day
	d1 = new Date (d1);
	d2 = new Date (d2);
	return ((d1.getFullYear () == d2.getFullYear ()) && (d1.getMonth () == d2.getMonth ()) && (d1.getDate () == d2.getDate ()));
	}
function stringLower (s) {
	return (s.toLowerCase ());
	}
function secondsSince (when) { 
	var now = new Date ();
	when = new Date (when);
	return ((now - when) / 1000);
	}
function padWithZeros (num, ctplaces) { 
	var s = num.toString ();
	while (s.length < ctplaces) {
		s = "0" + s;
		}
	return (s);
	}
function getDatePath (theDate, flLastSeparator) {
	if (theDate == undefined) {
		theDate = new Date ();
		}
	if (flLastSeparator == undefined) {
		flLastSeparator = true;
		}
	
	var month = padWithZeros (theDate.getMonth () + 1, 2);
	var day = padWithZeros (theDate.getDate (), 2);
	var year = theDate.getFullYear ();
	
	if (flLastSeparator) {
		return (year + "/" + month + "/" + day + "/");
		}
	else {
		return (year + "/" + month + "/" + day);
		}
	}
function multipleReplaceAll (s, adrTable, flCaseSensitive, startCharacters, endCharacters) { 
	if(flCaseSensitive===undefined){
		flCaseSensitive = false;
		}
	if(startCharacters===undefined){
		startCharacters="";
		}
	if(endCharacters===undefined){
		endCharacters="";
		}
	for( var item in adrTable){
		var replacementValue = adrTable[item];
		var regularExpressionModifier = "g";
		if(!flCaseSensitive){
			regularExpressionModifier = "gi";
			}
		var regularExpressionString = (startCharacters+item+endCharacters).replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
		var regularExpression = new RegExp(regularExpressionString, regularExpressionModifier);
		s = s.replace(regularExpression, replacementValue);
		}
	return s;
	}
function endsWith (s, possibleEnding, flUnicase) {
	if ((s == undefined) || (s.length == 0)) { 
		return (false);
		}
	var ixstring = s.length - 1;
	if (flUnicase == undefined) {
		flUnicase = true;
		}
	if (flUnicase) {
		for (var i = possibleEnding.length - 1; i >= 0; i--) {
			if (stringLower (s [ixstring--]) != stringLower (possibleEnding [i])) {
				return (false);
				}
			}
		}
	else {
		for (var i = possibleEnding.length - 1; i >= 0; i--) {
			if (s [ixstring--] != possibleEnding [i]) {
				return (false);
				}
			}
		}
	return (true);
	}
function beginsWith (s, possibleBeginning, flUnicase) { 
	if (s.length == 0) { //1/1/14 by DW
		return (false);
		}
	if (flUnicase == undefined) {
		flUnicase = true;
		}
	if (flUnicase) {
		for (var i = 0; i < possibleBeginning.length; i++) {
			if (stringLower (s [i]) != stringLower (possibleBeginning [i])) {
				return (false);
				}
			}
		}
	else {
		for (var i = 0; i < possibleBeginning.length; i++) {
			if (s [i] != possibleBeginning [i]) {
				return (false);
				}
			}
		}
	return (true);
	}
function isAlpha (ch) {
	return (((ch >= 'a') && (ch <= 'z')) || ((ch >= 'A') && (ch <= 'Z')));
	}
function isNumeric (ch) {
	return ((ch >= '0') && (ch <= '9'));
	}
function trimLeading (s, ch) {
	while (s.charAt (0) === ch) {
		s = s.substr (1);
		}
	return (s);
	}
function trimTrailing (s, ch) { 
	while (s.charAt (s.length - 1) === ch) {
		s = s.substr (0, s.length - 1);
		}
	return (s);
	}
function trimWhitespace (s) { //rewrite -- 5/30/14 by DW
	function isWhite (ch) {
		switch (ch) {
			case " ": case "\r": case "\n": case "\t":
				return (true);
			}
		return (false);
		}
	while (isWhite (s.charAt (0))) {
		s = s.substr (1);
		}
	while (s.length > 0) {
		if (!isWhite (s.charAt (0))) {
			break;
			}
		s = s.substr (1);
		}
	while (s.length > 0) {
		if (!isWhite (s.charAt (s.length - 1))) {
			break;
			}
		s = s.substr (0, s.length - 1);
		}
	return (s);
	}
function addPeriodAtEnd (s) {
	s = trimWhitespace (s);
	if (s.length == 0) {
		return (s);
		}
	switch (s [s.length - 1]) {
		case ".":
		case ",":
		case "?":
		case "\"":
		case "'":
		case ":":
		case ";":
		case "!":
			return (s);
		default:
			return (s + ".");
		}
	}
function getBoolean (val) { //12/5/13 by DW
	switch (typeof (val)) {
		case "string":
			if (val.toLowerCase () == "true") {
				return (true);
				}
			break;
		case "boolean":
			return (val);
			break;
		case "number":
			if (val == 1) {
				return (true);
				}
			break;
		}
	return (false);
	}
function bumpUrlString (s) { //5/10/14 by DW
	if (s == undefined) {
		s = "0";
		}
	function bumpChar (ch) {
		function num (ch) {
			return (ch.charCodeAt (0));
			}
		if ((ch >= "0") && (ch <= "8")) {
			ch = String.fromCharCode (num (ch) + 1);
			}
		else {
			if (ch == "9") {
				ch = "a";
				}
			else {
				if ((ch >= "a") && (ch <= "y")) {
					ch = String.fromCharCode (num (ch) + 1);
					}
				else {
					throw "rollover!";
					}
				}
			}
		return (ch);
		}
	try {
		var chlast = bumpChar (s [s.length - 1]);
		s = s.substr (0, s.length - 1) + chlast;
		return (s);
		}
	catch (tryError) {
		if (s.length == 1) {
			return ("00");
			}
		else {
			s = s.substr (0, s.length - 1);
			s = bumpString (s) + "0";
			return (s);
			}
		}
	}
function stringDelete (s, ix, ct) {
	var start = ix - 1;
	var end = (ix + ct) - 1;
	var s1 = s.substr (0, start);
	var s2 = s.substr (end);
	return (s1 + s2);
	}
function replaceAll (s, searchfor, replacewith) {
	function escapeRegExp (string) {
		return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
		}
	return (s.replace (new RegExp (escapeRegExp (searchfor), 'g'), replacewith));
	}
function stringCountFields (s, chdelim) {
	var ct = 1;
	if (s.length == 0) {
		return (0);
		}
	for (var i = 0; i < s.length; i++) {
		if (s [i] == chdelim) {
			ct++;
			}
		}
	return (ct)
	}
function stringNthField (s, chdelim, n) {
	var splits = s.split (chdelim);
	if (splits.length >= n) {
		return splits [n-1];
		}
	return ("");
	}
function dateYesterday (d) {
	return (new Date (new Date (d) - (24 * 60 * 60 * 1000)));
	}
function stripMarkup (s) { //5/24/14 by DW
	if ((s === undefined) || (s == null) || (s.length == 0)) {
		return ("");
		}
	return (s.replace (/(<([^>]+)>)/ig, ""));
	}
function maxStringLength (s, len, flWholeWordAtEnd, flAddElipses) {
	if (flWholeWordAtEnd == undefined) {
		flWholeWordAtEnd = true;
		}
	if (flAddElipses == undefined) { //6/2/14 by DW
		flAddElipses = true;
		}
	if (s.length > len) {
		s = s.substr (0, len);
		if (flWholeWordAtEnd) {
			while (s.length > 0) {
				if (s [s.length - 1] == " ") {
					if (flAddElipses) {
						s += "...";
						}
					break;
					}
				s = s.substr (0, s.length - 1); //pop last char
				}
			}
		}
	return (s);
	}
function random (lower, upper) {
	var range = upper - lower + 1;
	return (Math.floor ((Math.random () * range) + lower));
	}
function stringAddCommas (x) { //5/27/14 by DW
	return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}
function readHttpFile (url, callback) { //5/27/14 by DW
	var jxhr = $.ajax ({ 
		url: url,
		dataType: "text" , 
		timeout: 30000 
		}) 
	.success (function (data, status) { 
		callback (data);
		}) 
	.error (function (status) { 
		console.log ("readHttpFile: url == " + url + ", error == " + status.statusText + ".");
		callback (undefined);
		});
	}
function stringPopLastField (s, chdelim) { //5/28/14 by DW
	if (s.length == 0) {
		return (s);
		}
	if (endsWith (s, chdelim)) {
		s = stringDelete (s, s.length, 1);
		}
	while (s.length > 0) {
		if (endsWith (s, chdelim)) {
			return (stringDelete (s, s.length, 1));
			}
		s = stringDelete (s, s.length, 1);
		}
	return (s);
	}
function filledString (ch, ct) { //6/4/14 by DW
	var s = "";
	for (var i = 0; i < ct; i++) {
		s += ch;
		}
	return (s);
	}
function encodeXml (s) { //7/15/14 by DW
	var charMap = {
		'<': '&lt;',
		'>': '&gt;',
		'&': '&amp;',
		'"': '&'+'quot;'
		};
	s = s.toString();
	s = s.replace(/\u00A0/g, " ");
	var escaped = s.replace(/[<>&"]/g, function(ch) {
		return charMap [ch];
		});
	return escaped;
	}


var taskQ = []; 
function qNotEmpty () {
	return (taskQ.length > 0);
	}
function qSize () {
	return (taskQ.length);
	}
function qAddTask (taskcode, taskdata) { //add task at end of array
	if (taskcode == undefined) {
		taskcode = "";
		}
	if (taskdata == undefined) {
		taskdata = {};
		}
	taskQ [taskQ.length] = {
		code: taskcode,
		data: taskdata
		};
	}
function qRunNextTask () { //run the task at the beginning of array
	if (qNotEmpty ()) {
		var data = JSON.parse (JSON.stringify (taskQ [0].data)), code = taskQ [0].code;
		taskQ.splice (0, 1); //remove first item
		with (data) {
			eval (code);
			}
		}
	}
function qTest () {
	for (var i = 0; i < 10000; i++) {
		qAddTask ("console.log (val);", {val: i, filepath: "tunafish"});
		}
	setInterval (function () {qRunNextTask ()}, 1000); //call every second
	}

 
var riverCache = new Object (), flUseRiverCache = false;

function clearBuildRiverCache () {
	riverCache = new Object ();
	}
function getCalendarPath (theDay) {
	if (theDay == undefined) {
		theDay = dayRiverCovers;
		}
	return (s3CalendarDataFolder + getDatePath (theDay, false) + ".json");
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
			s3GetObject (s3path, function (error, data) {
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
			secs: secondsSince (starttime),
			ctDuplicatesSkipped: ctDuplicatesSkipped,
			whenGMT: starttime.toUTCString (),
			whenLocal: starttime.toLocaleString (),
			aggregator: myProductName + " v" + myVersion
			};
		jsontext = JSON.stringify (theRiver, undefined, 4);
		if (flAddJsonpWrapper) {
			jsontext = "onGetRiverStream (" + jsontext + ")";
			}
		if (flSave) {
			var fname = stringPopLastField (listname, ".") + ".js";
			s3NewObject (s3UserRiversPath + fname, jsontext, "application/json", "public-read", function (error, data) {
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
							reducedtitle = trimWhitespace (stringLower (story.title));
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
								for (var j = 0; j < feedstats.lists.length; j++) {
									if (feedstats.lists [j] == listname) {
										flThisFeedInList = true;
										break;
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
									theRiverFeed.whenLastUpdate = new Date (feedstats.whenLastNewItem).toUTCString ();
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
											if (stringCountFields (story.enclosure.type, "/") < 2) { //something like "image" -- not a valid type
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
										theItem.id = padWithZeros (story.id, 7);
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
					doOneDay (dateYesterday (theDay));
					}
				});
			}
		}
	doOneDay (starttime);
	
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
	console.log ("loadTodaysRiver: " + s3path);
	s3GetObject (s3path, function (error, data) {
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
	
	s3NewObject (getCalendarPath (dayRiverCovers), JSON.stringify (todaysRiver, undefined, 4), "application/json", "public-read", function (error, data) {
		serverData.stats.ctRiverSaves++;
		serverData.stats.whenLastRiverSave = now;
		if (!error) {
			flRiverDirty = false;
			serverData.stats.ctRiverSaveErrors++;
			serverData.stats.whenLastRiverSaveError = now;
			}
		if (callback != undefined) {
			callback ();
			}
		});
	}
function checkRiverRollover () { 
	var now = new Date ();
	if (!sameDay (now, dayRiverCovers)) { //rollover
		if (flRiverDirty) {
			saveTodaysRiver ();
			}
		todaysRiver = new Array (); //clear it out
		dayRiverCovers = now;
		serverData.stats.ctHitsToday = 0;
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
		function getString (s) {
			if (s == null) {
				s = "";
				}
			return (stripMarkup (s));
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
			item.description = trimWhitespace (getString (itemFromParser.description));
			if (item.description.length > serverData.prefs.maxBodyLength) {
				item.description = trimWhitespace (maxStringLength (item.description, serverData.prefs.maxBodyLength));
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
				item.outline = convertOutline (itemFromParser ["source:outline"]);
				console.log ("addToRiver: outline == " + JSON.stringify (item.outline, undefined, 4)); 
				}
		item.pubdate = getDate (itemFromParser.pubDate);
		item.comments = getString (itemFromParser.comments);
		item.feedUrl = urlfeed;
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
			consolemsg = maxStringLength (stripMarkup (itemFromParser.description), 80);
			}
		console.log ("***addToRiver: " + consolemsg);
	}

function loadServerData (callback) {
	console.log ("loadServerData: " + s3PrefsAndStatsPath);
	s3GetObject (s3PrefsAndStatsPath, function (error, data) {
		if (error) {
			console.log ("loadServerData: error == " + error.message);
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
		serverData.stats.ctHoursServerUp = secondsSince (whenServerStart) / 3600; 
		serverData.stats.secsSinceLastFeedRead = secondsSince (serverData.stats.whenLastFeedRead); 
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
	s3NewObject (s3PrefsAndStatsPath, JSON.stringify (serverData, undefined, 4));
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
	s3NewObject (s3FeedsInListsPath, JSON.stringify (feedsInLists, undefined, 4));
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
	s3NewObject (s3FeedsArrayPath, JSON.stringify (feedsArray, undefined, 4));
	}
function loadFeedsArray (callback) {
	s3GetObject (s3FeedsArrayPath, function (error, data) {
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
	
	if (random (0, 1) == 1) {
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
		if (secondsSince (feedstats.whenLastChosenToRead) < (serverData.prefs.ctMinutesBetwBuilds * 60)) { //not ready to read
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
	function getFolderPath (urlfeed) { //return path to S3 folder for this feed
		var s = urlfeed;
		if (beginsWith (s, "http://")) {
			s = stringDelete (s, 1, 7);
			}
		else {
			if (beginsWith (s, "https://")) {
				s = stringDelete (s, 1, 8);
				}
			}
		
		s = replaceAll (s, "/", ":");
		
		s = s3FeedsDataFolder + s + "/";
		return (s);
		}
	var folderpath = getFolderPath (urlfeed), infofilepath = folderpath + "feedInfo.json";
	var obj, starttime = new Date ();
	if (flwrite == undefined) {
		flwrite = false;
		}
	s3GetObject (infofilepath, function (error, data) {
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
			s3NewObject (infofilepath, JSON.stringify (obj, undefined, 4), "application/json", "public-read", function (error, data) {
				secsLastInit = secondsSince (starttime);
				});
			}
		else {
			secsLastInit = secondsSince (starttime);
			}
		});
	}
function saveFeed (feed) {
	s3NewObject (feed.stats.s3MyPath, JSON.stringify (feed, undefined, 4), "application/json", "public-read", function (error, data) {
		});
	}
function readFeed (urlfeed) {
	var starttime = new Date ();
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
				
				console.log ("readFeed: urlfeed == " + urlfeed);
				
				flFeedsArrayDirty = true;
			serverData.stats.ctActiveThreads++;
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
						
					
					//exclude items that newly appear in feed but have a too-old pubdate
						if ((item.pubDate != null) && (new Date (item.pubDate) < dateYesterday (feed.stats.mostRecentPubDate)) && (!flfirstread)) { 
							flAddToRiver = false;
							feed.stats.ctItemsTooOld++;
							feed.stats.whenLastTooOldItem = starttime;
							}
					
					if ((flAddToRiver) && (!flfirstread)) {
						addToRiver (urlfeed, item);
						
						//copy feed info from item into the feed record -- 6/1/14 by DW
							feed.feedInfo.title = item.meta.title;
							feed.feedInfo.link = item.meta.link;
							feed.feedInfo.description = item.meta.description;
						//copy feeds info from item into feeds in-memory array element -- 6/1/14 by DW
							feedstats.title = item.meta.title;
							feedstats.text = item.meta.title;
							feedstats.htmlurl = item.meta.link;
							feedstats.description = item.meta.description;
							flFeedsArrayDirty = true;
						}
					}
				
				if (serverData.prefs.flWriteItemsToFiles) { //debugging
					var path = feed.stats.s3FolderPath + "items/" + padWithZeros (ctitemsthisfeed++, 3) + ".json";
					s3NewObject (path, JSON.stringify (item, undefined, 4), "application/json", "public-read");
					}
				});
			feedparser.on ("end", function () {
				feed.stats.ctSecsLastRead = secondsSince (starttime);
				saveFeed (feed);
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
	s3GetObject (filepath, function (error, data) {
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
	if (endsWith (foldername, ".opml")) {
		foldername = stringDelete (foldername, foldername.length - 4, 5);
		}
	infofilepath = s3ListsDataFolder + foldername + "/listInfo.json";
	s3GetObject (infofilepath, function (error, data) {
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
		
		s3NewObject (infofilepath, JSON.stringify (obj, undefined, 4), "application/json", "public-read", function (error, data) {
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
	s3ListObjects (s3UserListsPath, function (obj) { //read user's list files
		if (obj.flLastObject != undefined) {
			}
		else {
			if (obj.Size > 0) { //it's a file
				var filepath = obj.s3path;
				var listname = stringNthField (filepath, "/", stringCountFields (filepath, "/")); //something like myList.opml
				serverData.stats.listNames [serverData.stats.listNames.length] = listname; //5/28/14 by DW
				initList (listname, function () {
					qAddTask ("readOneList (\"" + listname + "\", \"" + filepath + "\")");
					});
				}
			}
		});
	}
	
function applyPrefs () {
	http.globalAgent.maxSockets = serverData.prefs.maxThreads * 5;
	https.globalAgent.maxSockets = serverData.prefs.maxThreads * 5;
	}
function copyIndexFile () { //6/1/14 by DW
	if (serverData.prefs.enabled) {
		s3GetObject (s3IndexFile, function (error, data) {
			if (error) {
				request (urlIndexSource, function (error, response, htmltext) {
					if (!error && response.statusCode == 200) {
						s3NewObject (s3IndexFile, htmltext, "text/html", "public-read", function (error, data) {
							console.log ("copyIndexFile: " + s3IndexFile);
							});
						}
					});
				}
			});
		}
	}
function everyQuarterSecond () {
	if (serverData.prefs.enabled) {
		if (countHttpSockets () < serverData.prefs.maxThreads) {
			qRunNextTask ();
			}
		}
	}
function everySecond () {
	if (serverData.prefs.enabled) {
		var ct = serverData.prefs.ctReadsPerSecond;
		for (var i = 0; i < ct; i++) {
			if (countHttpSockets () <= serverData.prefs.maxThreads) {
				var feedstats = findNextFeedToRead ();
				if (feedstats != undefined) { //a feed is ready to read
					readFeed (feedstats.url);
					}
				} 
			}
		}
	}
function everyMinute () {
	var now = new Date ();
	serverData.stats.ctHttpSockets = countHttpSockets (); 
	serverData.stats.ctMinutes++;
	
	console.log (""); console.log ("everyMinute: " + now.toLocaleTimeString () + ", " + qSize () + " items on the task queue, " + serverData.stats.ctHttpSockets  + " sockets open, " + feedsArray.length + " feeds in the struct.");
	
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
			if (secondsSince (serverData.stats.whenLastBuild) >= (serverData.prefs.ctMinutesBetwBuilds * 60)) {
				loadListsFromFolder ();
				flFeedsInListsDirty = true;
				}
			}
		}
	}
function buildRiversArray () { //6/1/14 by DW
	var riversArray = new Array ();
	for (var i = 0; i < serverData.stats.listNames.length; i++) {
		var obj = new Object (), rivername = stringPopLastField (serverData.stats.listNames [i], ".");
		obj.url = "rivers/" + rivername + ".js"; //designed for an app running at the top level of the bucket
		obj.title = rivername;
		obj.longTitle =  rivername;
		obj.description = "";
		riversArray [i] = obj;
		}
	s3NewObject (s3RiversArrayPath, JSON.stringify (riversArray, undefined, 4), "application/json", "public-read", function (error, data) {
		console.log ("buildRiversArray: " + s3RiversArrayPath);
		});
	}
function buildAllRivers () {
	for (var i = 0; i < serverData.stats.listNames.length; i++) { 
		var listname = "\"" + serverData.stats.listNames [i] + "\"";
		var flskip = serverData.prefs.flSkipDuplicateTitles;
		var s = "buildOneRiver (" + listname + ", true, " + flskip + ", true);";
		qAddTask (s);
		
		}
	}
function everyFiveMinutes () {
	buildAllRivers ();
	buildRiversArray ();
	copyIndexFile (); //6/1/14 by DW
	}
function startup () {
	var myPort = Number (process.env.PORT || 1337);
	
	console.log (""); console.log (""); console.log (""); 
	console.log (myProductName + " v" + myVersion + " running on port " + myPort + ".");
	console.log (""); 
	
	loadServerData (function () {
		applyPrefs ();
		copyIndexFile (); //6/1/14 by DW
		
		
		saveServerData (); //so hours-server-up stats update immediately
		
		loadFeedsArray (function () {
			loadTodaysRiver (function () {
				loadListsFromFolder (); //adds tasks to the queue
				
				setInterval (function () {everySecond ()}, 1000); 
				setInterval (function () {everyQuarterSecond ()}, 250);
				setInterval (function () {everyMinute ()}, 60000); 
				setInterval (function () {everyFiveMinutes ()}, 300000); 
				
				http.createServer (function (httpRequest, httpResponse) {
					try {
						var parsedUrl = urlpack.parse (httpRequest.url, true), now = new Date (), startTime = now;
						console.log ("Received request: " + httpRequest.url);
						//stats
							serverData.stats.ctHits++;
							serverData.stats.ctHitsToday++;
							serverData.stats.ctHitsThisRun++;
						switch (httpRequest.method) {
							case "GET":
								switch (parsedUrl.pathname.toLowerCase ()) {
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
											hits: serverData.stats.ctHits, 
											hitsToday: serverData.stats.ctHitsToday,
											hitsThisRun: serverData.stats.ctHitsThisRun
											};
										httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
										httpResponse.end (JSON.stringify (myStatus, undefined, 4));    
										break;
									case "/serverdata":
										updateStatsBeforeSave ();
										httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
										httpResponse.end (JSON.stringify (serverData.stats, undefined, 4));    
										break;
									case "/feedstats":
										httpResponse.writeHead (200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
										httpResponse.end (JSON.stringify (feedsArray, undefined, 4));    
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
									default: //404 not found
										httpResponse.writeHead (404, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
										httpResponse.end ("\"" + parsedUrl.pathname.toLowerCase () + "\" is not one of the endpoints defined by this server.");
									}
								break;
							}
						}
					catch (tryError) {
						httpResponse.writeHead (503, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
						httpResponse.end (tryError.message);    
						}
					}).listen (myPort);
				});
			});
		
		});
	}

startup ();
