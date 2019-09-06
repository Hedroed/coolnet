const lobbyElem = document.getElementById('lobby')
const videoElem = document.getElementById('video')

const videosContainer = document.getElementById('videos-container')
const videoTitle = document.getElementById('video-title')
const roomsList = document.getElementById('rooms-list')
const autoplay = document.getElementById('autoplay')
const back = document.getElementById('back')

const screensharing = new Screen()

const sender = Math.round(Math.random() * 999999999) + 999999999

var sharing = false

var socket = io.connect()
socket.on('connect', function() {
    // setup peer connection & pass socket object over the constructor!
    socket.emit('new-user', {
        sender: sender,
    })
})

socket.send = function(message) {
    socket.emit('message', {
        sender: sender,
        data: message,
    })
}

screensharing.openSignalingChannel = function(callback) {
    return socket.on('message', callback)
}

screensharing.onscreen = function(_screen) {
    // console.log('Screen', _screen)

    var alreadyExist = document.getElementById(_screen.userid)
    if (alreadyExist) {
        // console.warn('Screen already exist')
        return
    }

    if (autoplay.checked) {
        screensharing.isModerator = false
        screensharing.view(_screen)
    } else {
        var entry = document.createElement('div')
        entry.id = _screen.userid

        var t = document.createTextNode(_screen.name + ' shared his screen.')
        entry.appendChild(t)
        
        var b = document.createElement('button')
        b.classList.add('join')
        var b_t = document.createTextNode('View')
        b.appendChild(b_t)

        b.setAttribute('data-roomid', _screen.roomid)
        b.setAttribute('data-userid', _screen.userid)
        b.addEventListener('click', function() {
            const button = this

            const _screen = {
                userid: button.getAttribute('data-userid'),
                roomid: button.getAttribute('data-roomid'),
            }
            screensharing.isModerator = false
            screensharing.view(_screen)
        })

        entry.appendChild(b)

        roomsList.insertBefore(entry, roomsList.firstChild)
    }
}

// on getting each new screen
screensharing.onaddstream = function(media) {
    media.video.id = media.userid
    let name = media.name

    videoTitle.removeChild(videoTitle.firstChild)
    let t = document.createTextNode("You are viewing " + name + "'s screen")
    videoTitle.appendChild(t)

    var video = media.video
    videosContainer.appendChild(video)
    sharing = true

    lobbyElem.classList.add('hidden')
    videoElem.classList.remove('hidden')

    if (media.type === 'local') {
        addStreamStopListener(media.stream, function() {
            location.reload()
        })
    }
}

function cleanupAndBack() {
    while (videosContainer.firstChild) {
        videosContainer.removeChild(videosContainer.firstChild)
    }
    lobbyElem.classList.remove('hidden')
    videoElem.classList.add('hidden')
}

// if someone leaves; just remove his screen
screensharing.onuserleft = function(userid) {
    console.log('User left', userid)
    roomsList.childNodes.forEach(e => e.id === userid && roomsList.removeChild(e))

    if(sharing) {
        if (screensharing.isModerator) return
        sharing = false
        cleanupAndBack()
    }

}

screensharing.onNumberOfParticipantsChanged = function(numberOfParticipants) {
    if (!screensharing.isModerator) return

    document.title = numberOfParticipants + ' users are viewing your screen!'
    var element = document.getElementById('number-of-participants')
    if (element) {
        element.innerHTML = numberOfParticipants + ' users are viewing your screen!'
    }
}

// check pre-shared screens
screensharing.check()

document.getElementById('share-screen').addEventListener('click', function() {
    var username = document.getElementById('user-name')

    screensharing.isModerator = true
    screensharing.setName(username.value)
    screensharing.share()
})

back.addEventListener('click', () => {
    if (sharing) {
        screensharing.leave()
        cleanupAndBack()
        autoplay.checked = false
        sharing = false
    }
})
