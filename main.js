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

function fillField(container, name, value, tabId) {
    const entry = document.createElement('div');
    entry.className = 'storage-entry';

    // Handle loglevel entries with a dropdown
    if (name.startsWith('loglevel:')) {
        entry.innerHTML = `<b>${name}:</b><br />`;
        const select = document.createElement('select');
        
        // Create dropdown options
        ['DEBUG', 'INFO', 'WARN', 'ERROR'].forEach(level => {
            const option = document.createElement('option');
            option.value = level;
            option.textContent = level;
            option.selected = (value === level);
            select.appendChild(option);
        });

        // Update storage when selection changes
        select.addEventListener('change', (e) => {
            const newValue = e.target.value;
            browser.scripting.executeScript({
                target: { tabId: tabId },
                func: (key, value) => {
                    localStorage.setItem(key, value);
                },
                args: [name, newValue]
            });
        });

        entry.appendChild(select);
    } else {
        // Existing click-to-copy behavior for other entries
        entry.innerHTML = `<b>${name}:</b><br /><span>${value}</span>`;
        entry.addEventListener('click', () => copy(value));
    }

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
    
    // if (!isLiveKit) {
    //     information.innerHTML = 'Not a LiveKit.io site';
    //     return;
    // }

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
    if (storageItems['lk-user-choices']) {
        try {
            const choices = JSON.parse(storageItems['lk-user-choices']);
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
            wrapper.addEventListener('click', () => copy(storageItems['lk-user-choices']));
            
            information.appendChild(wrapper);
        } catch (e) {
            fillField(information, 'User Choices (malformed)', storageItems['lk-user-choices'], currentTab.id);
        }
    }

    // Add other loglevel entries
    Object.entries(storageItems).forEach(([key, value]) => {
        if (key !== 'lk-user-choices') {
            fillField(information, key, value, currentTab.id);
        }
    });

    // Create Tools tab content
    const toolsContent = document.getElementById('tools-content');
    toolsContent.innerHTML = `
        <div class="tool-section">
            <h3>Debugging Tools</h3>
            <button class="tool-button" id="cloud-dashboard">
                Cloud Dashboard
                <span class="tool-description">Manage your LiveKit cloud projects</span>
            </button>
            <button class="tool-button" id="livekit-status">
                LiveKit Cloud Status
                <span class="tool-description">Real-time service status dashboard</span>
            </button>
            <button class="tool-button" id="webrtc-internals">
                Open WebRTC Internals
                <span class="tool-description">Chrome's WebRTC diagnostic page</span>
            </button>
            <button class="tool-button" id="webrtc-test">
                Run WebRTC Browser Test
                <span class="tool-description">LiveKit's connectivity check</span>
            </button>
            <button class="tool-button" id="chrome-flags">
                Open Chrome Flags
                <span class="tool-description">Experimental browser features</span>
            </button>
            <h3>Docs</h3>
            <button class="tool-button" id="docs-link">
                Documentation
                <span class="tool-description">LiveKit's official documentation</span>
            </button>
            <button class="tool-button" id="github-livekit">
                GitHub LiveKit
                <span class="tool-description">Core LiveKit repository</span>
            </button>
            <button class="tool-button" id="github-examples">
                LiveKit Examples
                <span class="tool-description">Official code examples and demos</span>
            </button>
        </div>
    `;

    // Add event listeners for tools
    toolsContent.querySelector('#livekit-status').addEventListener('click', () => {
        browser.tabs.create({ url: 'https://status.livekit.io/' });
    });
    
    toolsContent.querySelector('#webrtc-internals').addEventListener('click', () => {
        browser.tabs.create({ url: 'chrome://webrtc-internals/' });
    });
    
    toolsContent.querySelector('#webrtc-test').addEventListener('click', () => {
        browser.tabs.create({ url: 'https://livekit.io/webrtc/browser-test' });
    });
    
    toolsContent.querySelector('#chrome-flags').addEventListener('click', () => {
        browser.tabs.create({ url: 'chrome://flags/' });
    });

    toolsContent.querySelector('#cloud-dashboard').addEventListener('click', () => {
        browser.tabs.create({ url: 'https://cloud.livekit.io/' });
    });

    // Add event listener for the documentation link
    toolsContent.querySelector('#docs-link').addEventListener('click', () => {
        browser.tabs.create({ url: 'https://docs.livekit.io/home/' });
    });

    // Add event listeners for GitHub links
    toolsContent.querySelector('#github-livekit').addEventListener('click', () => {
        browser.tabs.create({ url: 'https://github.com/livekit' });
    });
    toolsContent.querySelector('#github-examples').addEventListener('click', () => {
        browser.tabs.create({ url: 'https://github.com/livekit-examples' });
    });
});

document.addEventListener('click', (e) => {
    if (e.target.matches('.tab-button')) {
        document.querySelectorAll('.tab-button, .tab-content').forEach(el => {
            el.classList.remove('active');
        });
        e.target.classList.add('active');
        
        const tabName = e.target.dataset.tab;
        document.getElementById(`${tabName === 'tools' ? 'tools-content' : 'information'}`)
            .classList.add('active');
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
