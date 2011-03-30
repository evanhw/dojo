define("dojo/listen", ["dojo/aspect", "dojo/lib/kernel"], function(aspect, dojo){
/*
 * An events module built using very minimal code needed. The export of this module 
 * is a function that can be used to listen for events on a target:
 * listen = require("events");
 * listen(node, "click", clickHandler);
 * 
 * The export of this module can be used as a mixin, to add on() and emit() methods
 * for listening for events and dispatching events:
 * var Evented = listen.Evented;
 * var EventedWidget = dojo.declare([Evented, Widget], {...});
 * widget = new EventedWidget();
 * widget.on("open", function(event){
 * 	... do something with event
 * });
 *
 * widget.emit("open", {name:"some event", ...});
 * 
 * You can also use listen function itself as a pub/sub hub:
 * listen("some/topic", function(event){
 * 	... do something with event
 * });
 * listen.publish("some/topic", {name:"some event", ...});
 */
 	"use strict";
	var attachEvent, after = aspect.after;
	function has(feature){
		var major = window.ScriptEngineMajorVersion;
		return {
			"dom-addeventlistener": document.addEventListener,
			"config-allow-leaks": dojo.config._allow_leaks,
			"jscript": major && (major() + ScriptEngineMinorVersion() / 10) 
		}[feature];
	}
	var undefinedThis = (function(){
		return this; // this depends on strict mode
	})();
	
	var listen = function(target, type, listener, dontFix){
		if(this == undefinedThis || !this.on){
			if(!listener){
				// two args, do pub/sub
				return listen(listen, target, type);
			}
			// this is being called directly, not being used for compose
			if(target.on){ // delegate to the target's on() method
				return target.on(type, listener);
			}
			// call with two args, where the target is |this|
			return prototype.on.call(target, type, listener);
		}/*else{
			 being used as a mixin, don't do anything
		}*/
	};
	listen.pausable =  function(target, type, listener, dontFix){
		var paused;
		var signal = listen(target, type, function(){
			if(!paused){
				return listener.apply(this, arguments);
			}
		}, dontFix);
		signal.pause = function(){
			paused = true;
		};
		signal.resume = function(){
			paused = false;
		};
	};
	var prototype = (listen.Evented = function(){}).prototype;
	prototype.on = /*prototype.addListener = prototype.addEventListener = prototype.subscribe = prototype.connect = */
			function(type, listener, dontFix){
		if(typeof type == "function"){
            // event handler function
            // listen(node, dojo.touch.press, touchListener);
            return type(this, listener);
        }
		var node = this;
        // normal path, the target is |this|
        if(this.addEventListener){
            // the target has addEventListener, which should be used if available (might or might not be a node, non-nodes can implement this method as well)
            var signal = {
                cancel: function(){
                    node.removeEventListener(type, listener, false);
                }
            };
            node.addEventListener(type, listener, false);
            return signal;
        }

        if(this.attachEvent && cleanupHandler && !this.onpage){
        	// we set the onpage function to indicate it is a node that needs cleanup. onpage is an unused event in IE, and non-existent elsewhere
        	this.onpage = cleanupHandler;
        	usedEvents[type] = true; // register it as one of the used events
        }
       // use aop
        return after(this, "on" + type, listener, true);
    }
	listen.destroy = function(node, listener){
		// summary:
		//		Extension event that is fired when a node is destroyed (through dojo.destroy)
		return after(node, "onpage", listener);
	}
    var undefinedThis = (function(){
            return this; // this depends on strict mode
        })();

	if(has("jscript") < 5.7 && !has("config-allow-leaks")){ 
		// prior to JScript 5.7 all cyclic references caused leaks, by default we memory 
		// manage IE for JScript < 5.7, but users can opt-out. The code below is executed
		//	node destroys (dojo.destroy) or on unload and will clear all the event handlers so
		// that the nodes GC'ed.
		// The previous dojo.connect code included some code to help protect against notorious memory leaks in IE with 
		// reference cycles. This worked by adding the global object into the reference chain that often is cyclic. The 
		// global object is basically always destroyed on page unload, and this break the cycle allowing nodes and 
		// references to be properly GC'ed. This hels prevent memory leaks on page transitions for earlier versions of IE. This mechanism 
		// isn't ideal. Adding the global into the reference chain effectively pins the reference cycle in memory. This 
		// actually introduces a memory leak for in page actions, as the reference won't be eliminated until the 
		// page is unloaded even when no cycles are present and GC is working properly.
		// This memory management mechanism (clearing event handlers on unload/destroy)
		// avoids adding extra memory leaks while still helping to prevent page transition leaks. 
		var usedEvents = {}, usedEventsArray; 
		var cleanupHandler = function(){
			if(usedEventsArray){
				for(var i = 0, l = usedEventsArray.length; i < l; i++){
					if(this[i]){
						this[i] = null;
					}
				}
			}else{
				// top level, need to create array and recurse down
				usedEventsArray = [];
				for(var i in usedEvents){
					usedEventsArray.push("on" + i);
				}
				var children = this.getElementsByTagName("*");
				i = children.length;
				var eventsLength = usedEventsArray.length;
				var element;
				while(element = children[--i]){
					if(element.onpage){ // the indicator that it has events, don't go in the loop unless it is there to move along faster
						element.onpage(usedEventsArray);
					}
				}
				this.onpage();
				usedEventsArray = null;
			}
		}
		listen(window, "unload", function(){
			cleanupHandler.call(document);
		});
		listen.destroy = function(node, listener){
			// override this to add onpage listeners after this memory managing one is created
			return listen(node, "page", listener);
		}
    }

	if(!has("dom-addeventlistener")){
		listen._fixEvent = function(evt, sender){
			// summary:
			//		normalizes properties on the event object including event
			//		bubbling methods, keystroke normalization, and x/y positions
			// evt:
			//		native event object
			// sender:
			//		node to treat as "currentTarget"
			if(!evt){
				var w = sender && (sender.ownerDocument || sender.document || sender).parentWindow || window;
				evt = w.event;
			}
			if(!evt){return(evt);}
			if(!evt.target){ // check to see if it has been fixed yet
				evt.target = evt.srcElement;
				evt.currentTarget = (sender || evt.srcElement);
				evt.layerX = evt.offsetX;
				evt.layerY = evt.offsetY;
				if(evt.type == "mouseover"){
					evt.relatedTarget = evt.fromElement;
				}
				if(evt.type == "mouseout"){
					evt.relatedTarget = evt.toElement;
				}
				if (!evt.stopPropagation) {
					evt.stopPropagation = stopPropagation;
					evt.preventDefault = preventDefault;
				}
				switch(evt.type){
					case "keypress":
						var c = ("charCode" in evt ? evt.charCode : evt.keyCode);
						if (c==10){
							// CTRL-ENTER is CTRL-ASCII(10) on IE, but CTRL-ENTER on Mozilla
							c=0;
							evt.keyCode = 13;
						}else if(c==13||c==27){
							c=0; // Mozilla considers ENTER and ESC non-printable
						}else if(c==3){
							c=99; // Mozilla maps CTRL-BREAK to CTRL-c
						}
						// Mozilla sets keyCode to 0 when there is a charCode
						// but that stops the event on IE.
						evt.charCode = c;
						_setKeyChar(evt);
						break;
				}
			}
			return evt;
		}
		var fixListener = function(target, type, listener){
			var signal = after(target, type, function(evt){
				evt = listen._fixEvent(evt, this);
				return listener.call(this, evt);
			}, true);
			target = null;
			return signal;
		};

		var _setKeyChar = function(evt){
			evt.keyChar = evt.charCode ? String.fromCharCode(evt.charCode) : '';
			evt.charOrCode = evt.keyChar || evt.keyCode;
		};
		// Called in Event scope
		var stopPropagation = function(){
			this.cancelBubble = true;
		};
		var preventDefault = listen._preventDefault = function(){
			// Setting keyCode to 0 is the only way to prevent certain keypresses (namely
			// ctrl-combinations that correspond to menu accelerator keys).
			// Otoh, it prevents upstream listeners from getting this information
			// Try to split the difference here by clobbering keyCode only for ctrl
			// combinations. If you still need to access the key upstream, bubbledKeyCode is
			// provided as a workaround.
			this.bubbledKeyCode = this.keyCode;
			if(this.ctrlKey){
				try{
					// squelch errors when keyCode is read-only
					// (e.g. if keyCode is ctrl or shift)
					return (this.keyCode = 0);
				}catch(e){
				}
			}
			this.returnValue = false;
		};
				
	}
	listen.publish = prototype.emit = /*prototype.publish = prototype.dispatchEvent = */function(type, event){
		type = "on" + type;
		this[type] && this[type](event);
	};
	return listen;
});
