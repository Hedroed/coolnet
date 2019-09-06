// Last updated On: May 12, 2018

// Latest file can be found here: https://cdn.webrtc-experiment.com/screen.js

// Muaz Khan     - https://github.com/muaz-khan
// MIT License   - https://www.webrtc-experiment.com/licence/

// Documentation - https://github.com/muaz-khan/WebRTC-Experiment/tree/master/screen-sharing

(function() {

    if(typeof getScreenId === 'undefined') {
        console.warn('getScreenId.js early load is recommended.');
    }

    if(typeof adapter === 'undefined' || typeof adapter.browserDetails === 'undefined') {
        // https://webrtc.github.io/adapter/adapter-latest.js
        console.warn('adapter.js is recommended.');
    }
    else {
        window.adapter = {
            browserDetails: {
                browser: 'chrome'
            }
        };
    }

    if(typeof IceServersHandler === 'undefined') {
        // https:/cdn.webrtc-experiment.com/IceServersHandler.js
        console.warn('IceServersHandler.js is recommended.');
    }

    // via: https://bugs.chromium.org/p/chromium/issues/detail?id=487935#c17
    // you can capture screen on Android Chrome >= 55 with flag: "Experimental ScreenCapture android"
    window.IsAndroidChrome = false;
    try {
        if (navigator.userAgent.toLowerCase().indexOf("android") > -1 && /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor)) {
            window.IsAndroidChrome = true;
        }
    } catch (e) {}

    const isEdge = navigator.userAgent.indexOf('Edge') !== -1 && (!!navigator.msSaveOrOpenBlob || !!navigator.msSaveBlob);

    // a middle-agent between public API and the Signaler object
    window.Screen = function(channel) {
        const self = this;
        let signaler = undefined;

        this.channel = channel || location.href.replace(/\/|:|#|%|\.|\[|\]/g, '');
        this.userid = getToken();

        // get alerted for each new meeting
        this.onscreen = function(screen) {
            if (self.detectedRoom) return;
            self.detectedRoom = true;

            self.view(screen);
        };

        function initSignaler() {
            // unique identifier for the current user
            signaler = new Signaler(self, self.userid);
        }

        function captureUserMedia(callback) {
            if(isEdge) {
                navigator.getDisplayMedia({video: true}).then(stream => {
                    addStreamStopListener(stream, function() {
                        if (self.onuserleft) self.onuserleft('self');
                    });

                    self.stream = stream;

                    var video = document.createElement('video');
                    video.id = 'self';
                    video.muted = true;
                    video.volume = 0;

                    try {
                        video.setAttributeNode(document.createAttribute('autoplay'));
                        video.setAttributeNode(document.createAttribute('playsinline'));
                        video.setAttributeNode(document.createAttribute('controls'));
                    } catch (e) {
                        video.setAttribute('autoplay', true);
                        video.setAttribute('playsinline', true);
                        video.setAttribute('controls', true);
                    }

                    video.srcObject = stream;

                    self.onaddstream({
                        video: video,
                        stream: stream,
                        userid: 'self',
                        type: 'local',
                        name: 'Your'
                    });

                    callback(stream);
                }, error => {
                    if (location.protocol === 'http:') {
                        alert('HTTPs is required.');
                    }

                    console.error(error);
                });
                return;
            }

            getScreenId(function(error, sourceId, screen_constraints) {
                if (IsAndroidChrome) {
                    screen_constraints = {
                        mandatory: {
                            chromeMediaSource: 'screen'
                        },
                        optional: []
                    };

                    screen_constraints = {
                        video: screen_constraints
                    };

                    error = null;
                }

                console.log('screen_constraints', JSON.stringify(screen_constraints, null, '\t'));
                navigator.mediaDevices.getUserMedia(screen_constraints).then(function(stream) {
                    addStreamStopListener(stream, function() {
                        if (self.onuserleft) self.onuserleft('self');
                    });

                    self.stream = stream;

                    var video = document.createElement('video');
                    video.id = 'self';
                    video.muted = true;
                    video.volume = 0;

                    try {
                        video.setAttributeNode(document.createAttribute('autoplay'));
                        video.setAttributeNode(document.createAttribute('playsinline'));
                        video.setAttributeNode(document.createAttribute('controls'));
                    } catch (e) {
                        video.setAttribute('autoplay', true);
                        video.setAttribute('playsinline', true);
                        video.setAttribute('controls', true);
                    }

                    video.srcObject = stream;

                    self.onaddstream({
                        video: video,
                        stream: stream,
                        userid: 'self',
                        type: 'local',
                        name: 'Your'
                    });

                    callback(stream);
                }).catch(function(error) {
                    if (adapter.browserDetails.browser === 'chrome' && location.protocol === 'http:') {
                        alert('HTTPs is required.');
                    } else if (adapter.browserDetails.browser === 'chrome') {
                        alert('Screen capturing is either denied or not supported. Please install chrome extension for screen capturing or run chrome with command-line flag: --enable-usermedia-screen-capturing');
                    } else if (adapter.browserDetails.browser === 'firefox') {
                        var Firefox_Screen_Capturing_Warning = 'Make sure that you are using Firefox Nightly and you enabled: media.getusermedia.screensharing.enabled flag from about:config page. You also need to add your domain in "media.getusermedia.screensharing.allowed_domains" flag.';
                        alert(Firefox_Screen_Capturing_Warning);
                    }

                    console.error(error);
                });
            }, true);
        }

        this.setName = function(newName) {
            !signaler && initSignaler();
            signaler.name = newName;
        };

        // share new screen
        this.share = function() {
            captureUserMedia(function() {
                !signaler && initSignaler();
                signaler.broadcast();
            });
        };

        // view pre-shared screens
        this.view = function(room) {
            !signaler && initSignaler();
            signaler.join({
                to: room.userid
            });
        };

        // check pre-shared screens
        this.check = initSignaler;
    };

    // object to store all connected peers
    const peers = {};

    function Signaler(root, userid) {
        var socket;

        this.name = userid;

        // self instance
        var self = this;

        // object to store ICE candidates for answerer
        var candidates = {};

        // it is called when your signaling implementation fires "onmessage"
        this.onmessage = function(message) {
            // if new room detected
            // if (message.broadcasting && !self.sentParticipationRequest) {
            if (message.broadcasting) {
                root.onscreen(message);
            }

            // if someone shared SDP
            if (message.sdp && message.to == userid) {
                // console.log("someone shared SDP");
                self.onsdp(message);
            }

            // if someone shared ICE
            if (message.candidate && message.to == userid) {
                // console.log("someone shared ICE");
                self.onice(message);
            }

            // if someone sent participation request
            if (message.participationRequest && message.to == userid) {
                console.log("someone sent participation request");

                var _options = options;
                _options.to = message.userid;
                _options.stream = root.stream;
                peers[message.userid] = Offer.createOffer(_options);

                if (root.onNumberOfParticipantsChanged) root.onNumberOfParticipantsChanged(Object.keys(peers).length);
            }
        };

        // if someone shared SDP
        this.onsdp = function(message) {
            var sdp = JSON.parse(message.sdp);

            if (sdp.type == 'offer') {
                var _options = options;
                _options.stream = root.stream;
                _options.sdp = sdp;
                _options.to = message.userid;
                _options.name = message.name;
                peers[message.userid] = Answer.createAnswer(_options);
            } else if (sdp.type == 'answer') {
                peers[message.userid].setRemoteDescription(sdp);
            }
        };

        // if someone shared ICE
        this.onice = function(message) {
            message.candidate = JSON.parse(message.candidate);

            var peer = peers[message.userid];
            if (!peer) {
                var candidate = candidates[message.userid];
                if (candidate) candidates[message.userid][candidate.length] = message.candidate;
                else candidates[message.userid] = [message.candidate];
            } else {
                peer.addIceCandidate(message.candidate);

                var _candidates = candidates[message.userid] || [];
                if (_candidates.length) {
                    for (var i = 0; i < _candidates.length; i++) {
                        peer.addIceCandidate(_candidates[i]);
                    }
                    candidates[message.userid] = [];
                }
            }
        };

        // it is passed over Offer/Answer objects for reusability
        var options = {
            onsdp: function(sdp, to) {
                console.log('local-sdp', JSON.stringify(sdp.sdp, null, '\t'));

                self.signal({
                    sdp: JSON.stringify(sdp),
                    to: to
                });
            },
            onicecandidate: function(candidate, to) {
                self.signal({
                    candidate: JSON.stringify(candidate),
                    to: to
                });
            },
            onuserleft: function(_userid) {
                if (root.onuserleft) root.onuserleft(_userid);
                
                if (root.onNumberOfParticipantsChanged) root.onNumberOfParticipantsChanged(Object.keys(peers).length);
            },
            onaddstream: function(stream, _userid, _username) {
                //Add video to receiver
                // console.debug('onaddstream >>>>>>', stream);
                console.log("Receiver add video");

                addStreamStopListener(stream, function() {
                    console.log("Sender stop");
                    if (root.onuserleft) root.onuserleft(_userid);
                });

                var video = document.createElement('video');
                video.id = _userid;

                try {
                    video.setAttributeNode(document.createAttribute('autoplay'));
                    video.setAttributeNode(document.createAttribute('playsinline'));
                    video.setAttributeNode(document.createAttribute('controls'));
                } catch (e) {
                    video.setAttribute('autoplay', true);
                    video.setAttribute('playsinline', true);
                    video.setAttribute('controls', true);
                }

                video.srcObject = stream;

                if (!root.onaddstream) return;
                root.onaddstream({
                    video: video,
                    stream: stream,
                    userid: _userid,
                    type: 'remote',
                    name: _username
                });
            }
        };

        // call only for session initiator
        this.broadcast = function() {

            self.isbroadcaster = true;
            self.stopBroadcasting = false;

            (function transmit() {
                if (self.stopBroadcasting) return
                
                self.signal({
                    broadcasting: true
                });
                setTimeout(transmit, 3000);
            })();
        };

        // called for each new participant
        this.join = function(_config) {
            self.signal({
                participationRequest: true,
                to: _config.to
            });
            // self.sentParticipationRequest = true; // Useless ?
        };

        // method to signal the data
        this.signal = function(data) {
            data.userid = userid;
            data.name = self.name;

            if(!socket) {
                console.error("No socket available")
                return
            }

            socket.send(JSON.stringify(data));
        };

        function leaveRoom() {
            self.signal({
                leaving: true
            });

            // stop broadcasting room
            if (self.isbroadcaster) self.stopBroadcasting = true;

            // leave user media resources
            if (root.stream) {
                if('stop' in root.stream) {
                    root.stream.stop();
                }
                else {
                    root.stream.getTracks().forEach(function(track) {
                        track.stop();
                    });
                }
            }
        }

        root.leave = leaveRoom;

        window.addEventListener('beforeunload', function() {
            leaveRoom();
        }, false);

        window.addEventListener('keyup', function(e) {
            if (e.keyCode == 116) {
                leaveRoom();
            }
        }, false);

        // signaling implementation
        if (!root.openSignalingChannel) {
            console.error("openSignalingChannel need to be implemented");
        } else {
            // custom signaling implementations
            // e.g. WebSocket, Socket.io, SignalR, WebSycn, XMLHttpRequest, Long-Polling etc.
            socket = root.openSignalingChannel(function(message) {
                message = JSON.parse(message);
                console.log("MSG", message);

                var isRemoteMessage = false;
                if (typeof userid === 'number' && parseInt(message.userid) != userid) {
                    isRemoteMessage = true;
                }
                if (typeof userid === 'string' && message.userid + '' != userid) {
                    isRemoteMessage = true;
                }

                if (isRemoteMessage) {
                    if (message.to) {
                        if (typeof userid == 'number') message.to = parseInt(message.to);
                        if (typeof userid == 'string') message.to = message.to + '';
                    }

                    if (!message.leaving) self.onmessage(message);
                    else {
                        root.onuserleft(message.userid);
                        if (root.onNumberOfParticipantsChanged) root.onNumberOfParticipantsChanged(Object.keys(peers).length);
                    }
                }
            });
        }

    }

    // reusable stuff
    var RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
    var RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription;
    var RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate;

    var iceServers = [];

    if(typeof IceServersHandler !== 'undefined') {
        iceServers = IceServersHandler.getIceServers();
    }

    iceServers = {
        iceServers: iceServers,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        iceCandidatePoolSize: 0
    };

    if(adapter.browserDetails.browser !== 'chrome') {
        iceServers = {
            iceServers: iceServers.iceServers
        };
    }

    function getToken() {
        if (window.crypto && window.crypto.getRandomValues && navigator.userAgent.indexOf('Safari') === -1) {
            var a = window.crypto.getRandomValues(new Uint32Array(3)),
                token = '';
            for (var i = 0, l = a.length; i < l; i++) {
                token += a[i].toString(36);
            }
            return token;
        } else {
            return (Math.random() * new Date().getTime()).toString(36).replace(/\./g, '');
        }
    }

    function onSdpError(e) {
        console.error('sdp error:', e);
    }

    // var offer = Offer.createOffer(config);
    // offer.setRemoteDescription(sdp);
    // offer.addIceCandidate(candidate);
    var offerConstraints = {
        OfferToReceiveAudio: false,
        OfferToReceiveVideo: false
    };

    if(adapter.browserDetails.browser === 'chrome' || adapter.browserDetails.browser === 'safari') {
        offerConstraints = {
            mandatory: offerConstraints,
            optional: []
        };
    }

    var Offer = {
        createOffer: function(config) {
            var peer = new RTCPeerConnection(iceServers);

            if('addStream' in peer) {
                peer.addStream(config.stream);
            }
            else if('addTrack' in peer) {
                config.stream.getTracks().forEach(function(track) {
                    peer.addTrack(track, config.stream);
                });
            }
            else {
                throw new Error('WebRTC addStream/addTrack is not supported.');
            }
            
            peer.onicecandidate = function(event) {
                if (event.candidate) config.onicecandidate(event.candidate, config.to);
            };

            peer.createOffer(offerConstraints).then(function(sdp) {
                sdp.sdp = setBandwidth(sdp.sdp);
                peer.setLocalDescription(sdp).then(function() {
                    config.onsdp(sdp, config.to);
                });
            }).catch(onSdpError);

            peer.oniceconnectionstatechange = peer.onsignalingstatechange = function() {
                if (peer && peer.iceConnectionState && peer.iceConnectionState.search(/disconnected|closed|failed/gi) !== -1) {
                    if(peers[config.to]) {
                        delete peers[config.to];
                    }

                    if (config.onuserleft) config.onuserleft(config.to);
                }
            };

            this.peer = peer;

            return this;
        },
        setRemoteDescription: function(sdp, callback) {
            callback = callback || function() {};

            console.log('setting remote descriptions', sdp.sdp);
            this.peer.setRemoteDescription(new RTCSessionDescription(sdp)).then(function() {
                callback();
            }).catch(onSdpError);
        },
        addIceCandidate: function(candidate) {
            console.log('adding ice', candidate.candidate);
            this.peer.addIceCandidate(new RTCIceCandidate({
                sdpMLineIndex: candidate.sdpMLineIndex,
                candidate: candidate.candidate
            }));
        }
    };

    // var answer = Answer.createAnswer(config);
    // answer.setRemoteDescription(sdp);
    // answer.addIceCandidate(candidate);
    var answerConstraints = {
        OfferToReceiveAudio: true,
        OfferToReceiveVideo: true
    };

    if(adapter.browserDetails.browser === 'chrome' || adapter.browserDetails.browser === 'safari') {
        answerConstraints = {
            mandatory: answerConstraints,
            optional: []
        };
    }

    var dontDuplicateOnAddTrack = {};
    var Answer = {
        createAnswer: function(config) {
            var peer = new RTCPeerConnection(iceServers);

            if('addStream' in peer) {
                peer.onaddstream = function(event) {
                    config.onaddstream(event.stream, config.to, config.name);
                };
            }
            else if('addTrack' in peer) {
                peer.onaddtrack = function(event) {
                    event.stream = event.streams.pop();

                    if(dontDuplicateOnAddTrack[event.stream.id] && adapter.browserDetails.browser !== 'safari') return;
                    dontDuplicateOnAddTrack[event.stream.id] = true;

                    config.onaddstream(event.stream, config.to, config.name);
                };
            }
            else {
                throw new Error('WebRTC addStream/addTrack is not supported.');
            }

            peer.onicecandidate = function(event) {
                if (event.candidate) {
                    config.onicecandidate(event.candidate, config.to);
                }
            };

            console.log('setting remote descriptions', config.sdp.sdp);
            peer.setRemoteDescription(new RTCSessionDescription(config.sdp)).then(function() {
                peer.createAnswer(answerConstraints).then(function(sdp) {
                    sdp.sdp = setBandwidth(sdp.sdp);
                    peer.setLocalDescription(sdp).then(function() {
                        // should we use peer.localDescription?
                        config.onsdp(sdp, config.to);
                    }).catch(onSdpError);
                }).catch(onSdpError);
            }).catch(onSdpError);
            

            this.peer = peer;

            return this;
        },
        addIceCandidate: function(candidate) {
            console.log('adding ice', candidate.candidate);

            this.peer.addIceCandidate(new RTCIceCandidate({
                sdpMLineIndex: candidate.sdpMLineIndex,
                candidate: candidate.candidate
            }));
        }
    };

    function setBandwidth(sdp) {
        if (adapter.browserDetails.browser === 'firefox') return sdp;
        if(adapter.browserDetails.browser === 'safari') return sdp;
        if(isEdge) return sdp;

        // https://github.com/muaz-khan/RTCMultiConnection/blob/master/dev/CodecsHandler.js
        if(typeof CodecsHandler !== 'undefined') {
            sdp = CodecsHandler.preferCodec(sdp, 'vp9');
        }

        // https://github.com/muaz-khan/RTCMultiConnection/blob/master/dev/BandwidthHandler.js
        if (typeof BandwidthHandler !== 'undefined') {
            window.isFirefox = adapter.browserDetails.browser === 'firefox';

            var bandwidth = {
                screen: 300, // 300kbits minimum
                video: 256 // 256kbits (both min-max)
            };
            var isScreenSharing = true;

            sdp = BandwidthHandler.setApplicationSpecificBandwidth(sdp, bandwidth, isScreenSharing);
            sdp = BandwidthHandler.setVideoBitrates(sdp, {
                min: bandwidth.video,
                max: bandwidth.video
            });
            return sdp;
        }

        // removing existing bandwidth lines
        sdp = sdp.replace(/b=AS([^\r\n]+\r\n)/g, '');

        // "300kbit/s" for screen sharing
        sdp = sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:300\r\n');

        return sdp;
    }

    window.addStreamStopListener = function (stream, callback) {
        stream.addEventListener('ended', function() {
            callback();
            callback = function() {};
        }, false);
        stream.addEventListener('inactive', function() {
            callback();
            callback = function() {};
        }, false);
        stream.getTracks().forEach(function(track) {
            track.addEventListener('ended', function() {
                callback();
                callback = function() {};
            }, false);
            track.addEventListener('inactive', function() {
                callback();
                callback = function() {};
            }, false);
        });
    };

})();
