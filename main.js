let applicationLK = document.getElementById("applicationLK");
let information = document.getElementById("information");
const webrtcStats = document.getElementById("webrtc-stats");

function copy(text) {
    const ta = document.createElement('textarea');
    ta.style.cssText = 'opacity:0; position:fixed; width:1px; height:1px; top:0; left:0;';
    ta.value = text;
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    ta.remove();
}

function fillField(container, name, value) {
    const entry = document.createElement('div');
    entry.className = 'storage-entry';
    entry.innerHTML = `<b>${name}:</b><br /><span>${value}</span>`;
    entry.addEventListener('click', () => copy(value));
    container.appendChild(entry);
}

if (typeof browser === "undefined") {
    var browser = chrome;
}

function getCurrentWindowTabs() {
    return browser.tabs.query({ currentWindow: true, active: true });
}

document.addEventListener('DOMContentLoaded', async () => {
    const currentTab = (await getCurrentWindowTabs())[0];
    const isLiveKit = currentTab.url?.includes('.livekit.io');
    
    if (!isLiveKit) {
        information.innerHTML = 'Not a LiveKit.io site';
        return;
    }

    const result = await browser.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: () => {
            const items = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('loglevel:') || key.startsWith('lk-user-choices')) {
                    console.log(key, localStorage.getItem(key));
                    items[key] = localStorage.getItem(key);
                }
            }
            return items;
        }
    });

    const storageItems = result[0].result;
    information.innerHTML = ''; // Clear previous content
    
    // Modified user choices handling
    if (storageItems['Ik-user-choices']) {
        try {
            const choices = JSON.parse(storageItems['Ik-user-choices']);
            const container = document.createElement('div');
            container.className = 'user-choices-container';
            
            // Create formatted display
            const content = document.createElement('div');
            content.className = 'user-choices-content';
            content.innerHTML = Object.entries(choices)
                .map(([key, value]) => `
                    <div class="user-choice-item">
                        <span class="choice-key">${key}:</span>
                        <span class="choice-value">${JSON.stringify(value)}</span>
                    </div>
                `).join('');
                
            // Create header with username if available
            const header = document.createElement('div');
            header.className = 'user-choices-header';
            header.textContent = `User Settings${choices.username ? ` for ${choices.username}` : ''}`;
            
            container.appendChild(header);
            container.appendChild(content);
            
            // Create wrapper div for click handling
            const wrapper = document.createElement('div');
            wrapper.className = 'user-choices-wrapper';
            wrapper.appendChild(container);
            wrapper.addEventListener('click', () => copy(storageItems['Ik-user-choices']));
            
            information.appendChild(wrapper);
        } catch (e) {
            fillField(information, 'User Choices (malformed)', storageItems['Ik-user-choices']);
        }
    }

    // Add other loglevel entries
    Object.entries(storageItems).forEach(([key, value]) => {
        if (key !== 'Ik-user-choices') {
            fillField(information, key, value);
        }
    });

    // Add to DOMContentLoaded callback after displaying user choices
    const testLink = document.createElement('div');
    testLink.innerHTML = `
        <button id="run-webrtc-test" class="test-button">
            Run WebRTC Browser Test
        </button>
    `;
    testLink.addEventListener('click', () => {
        browser.tabs.create({ url: 'https://livekit.io/webrtc/browser-test' });
    });
    information.appendChild(testLink);
});

document.addEventListener('click', (e) => {
    if (e.target.matches('.tab-button')) {
        document.querySelectorAll('.tab-button, .tab-content').forEach(el => {
            el.classList.remove('active');
        });
        e.target.classList.add('active');
        
        if (e.target.dataset.tab === 'webrtc') {
            // Open WebRTC internals in new tab
            browser.tabs.create({ url: 'chrome://webrtc-internals/' });
            // Switch back to LiveKit tab
            document.querySelector('.tab-button[data-tab="livekit"]').click();
        }
    }
});

async function getWebRTCConnections() {
    console.log('Starting WebRTC detection...');
    return browser.scripting.executeScript({
        target: { tabId: (await getCurrentWindowTabs())[0].id },
        func: () => {
            try {
                console.log('[Content Script] Checking for RTCPeerConnections...');
                
                if (!window._rtcTracker) {
                    console.log('[Content Script] Initializing RTC tracker...');
                    window._rtcTracker = {
                        connections: [],
                        originalPC: window.RTCPeerConnection,
                        init() {
                            console.log('[Content Script] Overriding RTCPeerConnection constructor...');
                            const self = this;
                            window.RTCPeerConnection = function(...args) {
                                console.log('[Content Script] New RTCPeerConnection created:', args);
                                const pc = new self.originalPC(...args);
                                self.connections.push(pc);
                                console.log('[Content Script] Tracked connections count:', self.connections.length);
                                return pc;
                            };
                            window.RTCPeerConnection.prototype = self.originalPC.prototype;
                        }
                    };
                    window._rtcTracker.init();
                } else {
                    console.log('[Content Script] Existing tracker found, connections:', window._rtcTracker.connections.length);
                }

                const connections = window._rtcTracker.connections.map(pc => {
                    try {
                        return {
                            id: pc.id || pc._id || Math.random().toString(36).slice(2),
                            connectionState: pc.connectionState,
                            iceConnectionState: pc.iceConnectionState,
                            pc: pc
                        };
                    } catch(e) {
                        console.error('[Content Script] Error accessing PC properties:', e);
                        return null;
                    }
                }).filter(Boolean);

                console.log('[Content Script] Returning connections:', connections);
                return connections;
            } catch(e) {
                console.error('[Content Script] RTC tracking error:', e);
                return [];
            }
        }
    });
}

async function refreshWebRTCStats() {
    console.log('Refreshing WebRTC stats...');
    try {
        const result = await getWebRTCConnections();
        console.log('Detection results:', result);

        webrtcStats.innerHTML = '';
        
        if (result[0].result.length === 0) {
            console.warn('No WebRTC connections detected');
            webrtcStats.innerHTML = `
                <div class="no-connections">
                    No active WebRTC connections detected.<br>
                </div>
            `;
            return;
        }

        console.log('Processing connections:', result[0].result);
        result[0].result.forEach(conn => {
            const container = document.createElement('div');
            container.className = 'webrtc-connection';
            container.innerHTML = `
                <h4>Connection ${conn.id}</h4>
                <div>Status: ${conn.connectionState}</div>
                <div>ICE State: ${conn.iceConnectionState}</div>
                <div class="stats-container"></div>
            `;
            webrtcStats.appendChild(container);
            updateConnectionStats(conn.id, container.querySelector('.stats-container'));
        });
    } catch(e) {
        console.error('Error in refreshWebRTCStats:', e);
        webrtcStats.innerHTML = `Error: ${e.message}`;
    }
}

async function updateConnectionStats(connectionId, container) {
    try {
        const stats = await browser.scripting.executeScript({
            target: { tabId: (await getCurrentWindowTabs())[0].id },
            func: (connectionId) => {
                return new Promise(resolve => {
                    try {
                        const pc = Object.values(window)
                            .find(v => v instanceof RTCPeerConnection && 
                                  (v.id === connectionId || v._id === connectionId));
                        
                        if (!pc) return resolve(null);
                        
                        pc.getStats().then(stats => {
                            const results = {};
                            stats.forEach(report => {
                                results[report.type] = Object.fromEntries(
                                    Object.entries(report).filter(([k]) => !['type', 'timestamp', 'id'].includes(k))
                                );
                            });
                            resolve(results);
                        }).catch(e => resolve({ error: e.message }));
                    } catch (e) {
                        resolve({ error: e.message });
                    }
                });
            },
            args: [connectionId]
        });

        if (stats[0].result) {
            const pre = document.createElement('pre');
            pre.textContent = stats[0].result.error 
                ? `Error: ${stats[0].result.error}`
                : JSON.stringify(stats[0].result, null, 2);
            container.appendChild(pre);
        }
    } catch (e) {
        console.error('Stats error:', e);
        container.textContent = `Error retrieving stats: ${e.message}`;
    }
}
