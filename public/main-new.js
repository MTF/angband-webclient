var safety = 10;            // for font size calculation
var initComplete = false    // used to do some stuff only after this will be true

var protocol = location.protocol === "https:" ? "wss" : "ws";
var socketURL = protocol + '://' + location.hostname + ((location.port) ? (':' + location.port) : '') + '/meta';
var socket;

var spyglass = {};
var playing = false;
var dimensions= {};
// var terminfo = 'xterm-256color';
// var term = new Terminal({
// 	termName: terminfo,
// 	colors: Terminal.xtermColors,
// 	cols: dimensions.cols,
// 	rows: dimensions.rows,
// 	cursorBlink: false
// });
// term.applicationCursor=true;

var fonts = [
	"Share Tech Mono",
	"Fira Mono",
	"Nova Mono",
	"Overpass Mono",
	"Oxygen Mono",
	"Cutive Mono",
	"VT323",
	"Anonymous Pro",
	"PT Mono",
	"Ubuntu Mono",
	"Cousine",
	"Space Mono",
	"Droid Sans Mono",
	"Source Code Pro",
	"Roboto Mono",
	"Inconsolata",
	"Lucida Console",
	"Courier"
];
var font_sizes = [8,9,10,10.5,11,12,13,14,15,16,17,18,19,20];
var localStorage;

function addMessage(msg, extra_class) {
	var $msg = $(msg);
	var classes = [];
	if(msg.extra) 
		classes = msg.extra.join(" ");
	if(!extra_class) {
		var $m = $('<div class="message"><span class="user '+classes+'">'+msg.user+'</span>: <span class="msg"></span></div>');
		$m.find("span.msg").text(msg.message);
		$("#chatlog .wrapper").append($m);
	}
	else 
		$("#chatlog .wrapper").append('<div class="message"><span class="system">' + msg + '</span></div>');
}
function updateUserCount(users) { 
	$("#peoplelist .info").html("<p>there " + (users.length>1?"are":"is") + " <b>" + users.length + "</b> user" + (users.length>1?"s":"") + " online");
	$("#peoplelist .people").html("");
	for(var i=0; i<users.length; i++)
		$("#peoplelist .people").append("<div> - " + users[i] + "</div>");
}
function listMatches(matches) {
	$("#watchmenu ul").html("");
	var players = Object.keys(matches);
	if(players.length > 0) {
		for(var i=0; i<players.length; i++) {
			var idle = matches[players[i]].idletime > 0 ? ', idle for <span>'+matches[players[i]].idletime+'0</span> seconds' : "";
			$("#watchmenu ul").append(function(i) {
			    return $('<li><span>'+players[i]+'</span> playing <span>'+matches[players[i]].game+'</span>'+idle+'</li>').click(function() {
			        applyTerminal("spectate", players[i], 1, "no", matches[players[i]].dimensions);
			    });
			}(i));			
		}
	}
	else {
		$("#watchmenu ul").append('<li>there are no live games right now</li>');
	}
}
function listFiles(files) {
	var $tab = $("#tab-files div");
	var user = files.username;
	delete files.username;
	var games = Object.keys(files);
	if(games.length === 0)
		return;
	$tab.html("");
	for(var i=0; i<games.length; i++) {
		var $game = $('<div class="game">' +games[i]+ '</div>');
		var userfiles = files[games[i]];
		if(userfiles.length > 0) {
			for(var f=0; f<userfiles.length; f++) {
				$game.append('<a href="/' +user+ '/' +games[i]+ '/' +userfiles[f]+ '" target="_blank">' +userfiles[f]+ '</a>');
			}
		}
		else
			$game.append('<span>no files</span>');
		$tab.append($game);
	}
	
}

function showMenu(){
	$("#terminal-pane").addClass("hidden");
	$("#games-lobby").removeClass("hidden");
}
function showTab(pos, el) {
	const tabs = $(".tab-panels").children().map(function(i,e){return e.id;});
	for(var i=0; i<tabs.length; i++) {
		if(i === pos-1)
			$("#"+tabs[i]).removeClass("hidden")
		else 
			$("#"+tabs[i]).addClass("hidden");
	}
	if(el) {
    	$(".tab-buttons a").removeClass("selected");
    	$(el).addClass("selected");
	}
}

function createTerminal(dimensions) {
	return new Terminal({
		termName: 'xterm-256color',
		colors: Terminal.xtermColors,
		cols: dimensions.cols,
		rows: dimensions.rows,
		cursorBlink: false
	});
}
function applyTerminal(mode, qualifier, panels, walls, d) {
	$terminal = $("#terminal-container");
	dimensions = d;
	if(mode === "play") {
		if (!playing){
			playing = true;
			spyglass['default'] = createTerminal(d);
			$("#navigation ul").append(function() {
				return $('<li><a href="#"> - ' + qualifier + ' (your game)</a></li>').click(function() {
					applyTerminal("play", qualifier, panels, walls, d);
				});
			});
			socket.send(JSON.stringify({
				eventtype:'newgame',
				content: {
					game: qualifier,
					panels: panels,
					dimensions: d,
					walls: walls
				}
			}));
			spyglass['default'].on('data', function(data) {
				socket.send(JSON.stringify({eventtype: 'gameinput', content: data}));
			});
		}
		$terminal.html("");
		spyglass['default'].open($terminal.get(0));
	}
	else if(mode === "spectate") {
		if (typeof(spyglass[qualifier])=='undefined') {
			$("#navigation ul").append(function() {
				return $('<li><a href="#"> - ' + qualifier + '</a></li>').click(function() {
					applyTerminal("spectate", qualifier, panels, walls, d);
				});
			});
			spyglass[qualifier] = createTerminal(d);
			socket.send(JSON.stringify({eventtype:'subscribe', content:{player:qualifier}}));
		}
		$terminal.html("");
		spyglass[qualifier].open($terminal.get(0));
	}
	
	// resize terminal container to fit remaining space nicely
	adjustTerminalFontSize();
	
	// hide lobby and unhide terminal
	$("#games-lobby").addClass("hidden");
	$("#terminal-pane").removeClass("hidden");
}
function cleanSpyGlass(matches){
	$("#navigation ul").html("");
	$("#navigation ul").append(function() {
		return $('<li><a id="navigation-home" href="#"> - home</a></li>').click(function() {
			$("#terminal-pane").addClass("hidden");
			$("#games-lobby").removeClass("hidden");
		});
	});
	var players = Object.keys(matches);
	if(Object.keys(spyglass).length > 0) {
		for(var i in spyglass) {
			if (i=='default'){
				$("#navigation ul").append(function(i) {
					return $('<li><a href="#"> - your game</a></li>').click(function() {
						var panels = $("#subwindows").val();
						var walls = false;
						var d = { rows: $("#term-rows").val(), cols: $("#term-cols").val() };
						var gamename = $("#gameselect").val();
						applyTerminal("play", gamename, panels, walls, d);
					});
				}(i));
			} else if (players.includes(i)) {
				$("#navigation ul").append(function(i) {
					return $('<li><a href="#"> - ' + i + '</a></li>').click(function() {
						applyTerminal("spectate", i, 1, false, matches[i].dimensions);
					});
				}(i));	
			} else {
				delete spyglass[i];
			}
		}
	}
}
function closeGame(){
	$("#navigation ul").html("");
	$("#navigation ul").append(function() {
		return $('<li><a id="navigation-home" href="#"> - home</a></li>').click(function() {
			$("#terminal-pane").addClass("hidden");
			$("#games-lobby").removeClass("hidden");
		});
	});
	if(Object.keys(spyglass).length > 0) {
		for(var i in spyglass) {
			if (i!='default') {
				$("#navigation ul").append(function(i) {
					return $('<li><a href="#"> - ' + i + '</a></li>').click(function() {
						applyTerminal("spectate", i, 1, false);
					});
				}(i));	
			} else {
				delete spyglass[i];
			}
		}
	}
	$("#terminal-pane").addClass("hidden");
	$("#games-lobby").removeClass("hidden");
	playing=false;
}
function adjustTerminalFontSize() {
	$("#terminal-container").css("font-size", 6);
	$("#tester").css("display", "initial");
	$("#tester").css("visibility", "hidden");
	var sizes = font_sizes;
	var window_width = $(window).innerWidth();
	var window_height = $(window).innerHeight();
	var $mainpane = $(".pane-main");
	var mph = $mainpane.innerHeight();
	var mpw = $mainpane.innerWidth();
	var selected_size = sizes[0];
	var i = 6, found = false;
	while(i<100 && !found) {
		$("#tester").css('font-size', i + "px");
		var tw = $("#tester").innerWidth();
		var th = $("#tester").innerHeight();
		var cfs = $("#tester").css('font-size');
		var sidebar_pos = $("#opt-sidebar-bottom").prop("checked");
		var check_width = dimensions.cols * tw > mpw-safety;
		var check_height = dimensions.rows * th > mph-safety;
		if(sidebar_pos || window_width < 1000)
			check_height = dimensions.rows * th > window_height - 200;
		if(check_height || check_width)
			found = true;
		else 
			selected_size = i;
		i = i + 0.5;
	}
	$("#tester").css("display", "none");
	$("#terminal-container").css("font-size", selected_size + "px");
}

function initChat() {
	socket = new WebSocket(socketURL);
	socket.addEventListener('message', function (ev) {
		var data = JSON.parse(ev.data);
		switch(data.eventtype) {
			case "gamelist":
				// init angband variants list box
				initGameList(data.content); loadSelectedGameName();
				break;
			case "chat":
				addMessage(data.content); 
				if(initComplete)
				    $("#chatlog .wrapper").animate({ scrollTop: $('#chatlog .wrapper').prop("scrollHeight")}, 300);
				break;
			case "usercount":
				updateUserCount(data.content); break;
			case "matchupdate":
				listMatches(data.content); cleanSpyGlass(data.content); break;
			case "fileupdate":
				listFiles(data.content); break;
			case "spectatorinfo":
				addMessage(data.content,"system"); break;
			case "owngameoutput":
				spyglass['default'].write(data.content); break;
			case "gameover":
				closeGame(); break;
			case "gameoutput":
				if (typeof(spyglass[data.content.player])!='undefined') {
					spyglass[data.content.player].write(data.content.data);
				} 
				else {
					spyglass[data.content.player] = new Terminal({
						termName: terminfo,
						colors: Terminal.xtermColors,
						cols: dimensions.cols,
						rows: dimensions.rows,
						cursorBlink: false
					});
					spyglass[data.content.player].write(data.content.data);
				}
				break;
			default:
				console.warn("unknown socket event occured", data.eventtype); break;
		}
	});
	socket.addEventListener('close', function () {
		addMessage("***Disconnected***", "system");
		// todo: attempt to reconnect!
	});
	socket.addEventListener('open', function () {
		addMessage("***Connected to chat***", "system");
	});
	$("#new-message-input input").keypress(function(e) {
		if (!e) e = window.event;
		var keyCode = e.keyCode || e.which;
		if (keyCode == '13') {
		    if($(this).val().length > 0) {
    			socket.send(JSON.stringify({eventtype:'chat', content:$(this).val()}));
    			$(this).val("");
    			$("#chatlog .wrapper").animate({ scrollTop: $('#chatlog .wrapper').prop("scrollHeight")}, 1000);
		    }
		}
	});
}

function initGameList(games) {
	// populate select
	for(var i=0; i<games.length; i++) {
		var g=games[i];
		$("#gameselect").append('<option value='+g.name+' title="'+g.desc+'">'+g.longname+'</option>');
	}
	// select onchange
	$("#gameselect").change(function(e) {
		for(var i=0; i<games.length; i++) {
			if(e.target.value === games[i].name) {
				$("#game-description").html(games[i].desc);
				saveSelectedGameName(e.target.value);
				loadDefaultGameOptions(e.target.value);
				loadGameOptions(e.target.value);
			}
		}
		
	});
	$("#playbutton").click(function() {
		var gamename = $("#gameselect").val();
		var panels = $("#subwindows").val();
		var walls = false;
		var dimensions = {
			rows: $("#term-rows").val(),
			cols: $("#term-cols").val()
		}
		applyTerminal("play", gamename, panels, walls, dimensions);
	});
}

function changeTerminalFont(family, skipSaving) {
	var f = '"' + family + '", monospace';
	$("#terminal-container").css("font-family", f);
	$("#tester").css("font-family", f);
	$("#terminal-container").css("font-size", "6px");
	$("#tester").css("font-size", "6px");
	adjustTerminalFontSize();
	if(!skipSaving) saveOption("terminal_font_family", family);
}

function changeSidebarOnBottom(force, skipSaving) {
	if(force) {
		$(".flex").css("flex-direction", "column");
		$(".flex .pane-main").css("flex-grow", 0);
		$(".flex .pane-side").css("width", "100%");
		$(".flex .pane-side").css("flex-grow", 1);
	}
	else {
		$(".flex").css("flex-direction", "row");
		$(".flex .pane-main").css("flex-grow", 1);
		$(".flex .pane-side").css("width", "20%");
		$(".flex .pane-side").css("flex-grow", 0);
	}
	adjustTerminalFontSize();
	if(!skipSaving) saveOption("sidebar_on_bottom", force);
}

function changeUIFontSize(size, skipSaving) {
	$("html, body, #container").css("font-size", size);
	adjustTerminalFontSize();
	if(!skipSaving) saveOption("ui_font_size", size);
}

function changeBorderStyle(borderstyle, skipSaving) {
	$(".pane-main .pane-side").css("border-style", borderstyle);
	
}

function changeBackgroundColor(bgcolor, skipSaving) {
	if (tabcolor.match(/[[a-f][A-F]\d]+?/) != null && tabcolor.length == 6){
		$("html, body, #container").css("background-color", bgcolor);
		//if(!skipSaving) saveOption("ui_background_color", bgcolor);
	}
}

function changeMenuColor(tabcolor, skipSaving) {
	if (tabcolor.match(/[[a-f][A-F]\d]+?/) != null && tabcolor.length == 6){
		$(".panel").css("background-color", tabcolor);
		//if(!skipSaving) saveOption("ui_menu_color", tabcolor);
	}
}

function saveOption(opt, val) {
	if(window.localStorage) {
		var ls = window.localStorage.getItem("aw_options");
		if(!ls) ls = {};
		else ls = JSON.parse(ls);
		ls[opt] = val;
		window.localStorage.setItem("aw_options", JSON.stringify(ls));
	}
}

function loadAndApplyOptions() {
	if(window.localStorage) {
		var ls = window.localStorage.getItem("aw_options");
		if(ls) {
			ls = JSON.parse(ls);
			// // restore terminal font
			if(ls["terminal_font_family"]) {
				changeTerminalFont(ls["terminal_font_family"], false);
				$("#extra-fonts").val(ls["terminal_font_family"]);
			}
			
			// ui font size
			if(ls["ui_font_size"]) {
				changeUIFontSize(ls["ui_font_size"], false);
				$("#opt-ui-font-size").val(ls["ui_font_size"]);
			}
			
			// sidebar position
			if(ls["sidebar_on_bottom"]) {
				changeSidebarOnBottom(ls["sidebar_on_bottom"], false);
				$("#opt-sidebar-bottom").prop("checked", ls["sidebar_on_bottom"]);
			}
			
		}
	}
}


function saveSelectedGameName(game) {
	if(localStorage) {
		localStorage.setItem("aw_selected_game", game);
	}
}
function loadSelectedGameName() {
	if(localStorage) {
		var g = localStorage.getItem("aw_selected_game");
		if(g) $("#gameselect").val(g).trigger("change");
		else $("#gameselect").val("angband").trigger("change");
	}
}
function saveGameOptions() {
	if(localStorage) {
		var game = $("#gameselect").val();
		var opts = {
			rows: $("#term-rows").val(),
			cols: $("#term-cols").val(),
			subwindows: $("#subwindows").val(),
			ascii_walls: $("#ascii-walls").val()
		};
		localStorage.setItem("aw_options_" + game, JSON.stringify(opts));
	}
}
function loadGameOptions(game) {
	if(localStorage) {
		var opts = localStorage.getItem("aw_options_" + game);
		if(!opts)
			return loadDefaultGameOptions(game);
		opts = JSON.parse(opts);
		$("#term-rows").val(opts.rows);
		$("#term-cols").val(opts.cols);
		// $("#term-font").val(opts.font);
		$("#subwindows").val(opts.subwindows);
		$("#ascii-walls").val(opts.ascii_walls);
	}
	else
		loadDefaultGameOptions(game);
}
function loadDefaultGameOptions(game) {
	$("#term-rows").html(""); 
	$("#term-cols").html(""); 
	var rows = [24,100], row = 50;
	var cols = [80,215], col = 120;
	var subwindows = 1;
	var ascii_walls = false;
	// var font = "monospace";
	switch (game) {
			case 'sangband':
					rows[0] = 47; break;
	}
	var $rows, $cols, $font, $subwindows, $walls, i;
	for(i=rows[0]; i<=rows[1]; i++) $rows += '<option value="'+i+'">'+i+'</option>';
	for(i=cols[0]; i<=cols[1]; i++) $cols += '<option value="'+i+'">'+i+'</option>';
	$("#term-rows").append($rows); $("#term-rows").val(row);
	$("#term-cols").append($cols); $("#term-cols").val(col);
	// $("#term-font").val(font);
	$("#subwindows").val(subwindows);
	$("#ascii-walls").val(ascii_walls);
}

$(function() {
	localStorage = window.localStorage;
	
	// add extra fonts
	fonts = fonts.sort();
	fonts.map(function(f,i) {
		$("#extra-fonts").append('<option value="' + f + '">' + f + '</option>');
	});
	$("#extra-fonts").change(function(e) { changeTerminalFont(e.target.value); });
	
	// add bottom sidebar force option
	$("#opt-sidebar-bottom").change(function(e) { changeSidebarOnBottom(e.target.checked); });
	
	// add ui font size options
	font_sizes.map(function(f,i) {
		$("#opt-ui-font-size").append('<option value="' + f + 'px">' + f + 'px</option>');
	});
	$("#opt-ui-font-size").change(function(e) { changeUIFontSize(e.target.value); });
	$("#opt-ui-font-size").val($("html").css("font-size"));
	
	// add more options
	var borderstyles = ['solid','inset','outset','ridge','groove','none'];
	for (var i in borderstyles){
		$("#opt-ui-border-style").append('<option value="' + borderstyles[i] + '">' + borderstyles[i] + '</option>');
	}
	$("#opt-ui-border-style").change(function() { changeBorderStyle($("#opt-ui-border-style").val()); });
	$("#opt-ui-body-color").val($("body").css("background-color"));
	$("#opt-ui-chat-color").val($(".panel").css("background-color"));
	$("#opt-ui-chat-color").change(function() { changeMenuColor($("#opt-ui-border-style").val()); });
	
	// restore and apply options from local storage
	loadAndApplyOptions();
	
	// init and open chat tab by default
	initChat(); showTab(2);
	
	// terminal resizer
	$(window).resize(function() { adjustTerminalFontSize(); });
	
	// navigation to home button
	$("#navigation-home").click(function() {
    	$("#terminal-pane").addClass("hidden");
    	$("#games-lobby").removeClass("hidden");
	});
	
    // scroll chat messages
	setTimeout(function() {
	    $("#chatlog .wrapper").animate({ scrollTop: $('#chatlog .wrapper').prop("scrollHeight")}, 300);
	    initComplete = true;
	}, 1000);
	
	// game option change handlers
	$("#term-cols,#term-rows,#subwindows,#ascii-walls").change(function() { saveGameOptions(); });
});