import fs from 'fs';
import path from 'path';
import https from 'https';

const API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
let apiKey;

async function fetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve({
                        ok: res.statusCode === 200,
                        status: res.statusCode,
                        json: () => JSON.parse(data),
                    })
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', error => {
            reject(error);
        });
    });
}

function createDir(...pathArray) {
    const dir = path.join(...pathArray);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
}

function writeJson(filePath, object) {
    fs.writeFileSync(filePath, JSON.stringify(object, null, 2));
}

async function getResponse(method, parameters) {
    const parameterStrings = [];

    for (const key in parameters) {
        const value = parameters[key];
        if (typeof value === 'string' || typeof value === 'number') {
            parameterStrings.push(`${key}=${value}`);
        } else if (Array.isArray(value)) {
            parameterStrings.push(`${key}=${value.join(',')}`);
        } else {
            throw new Error(`Invalid parameter: ${value}`);
        }
    }

    if (apiKey === undefined) {
        throw new Error('API Key is empty');
    }

    const queryString = `${API_BASE_URL}/${method}?key=${apiKey}&${parameterStrings.join('&')}`;
    console.log(`Query: ${queryString}`);

    try {
        const response = await fetch(queryString);
        if (response.ok) {
            return await response.json();
        } else {
            throw new Error(`Response code ${response.status}`);
        }
    } catch (error) {
        throw new Error(error.message);
    }
}

async function getAndCacheResponse(method, parameters, filePath, idsGetter, targetIds) {
    let response;

    if (fs.existsSync(filePath)) {
        const savedResponse = JSON.parse(fs.readFileSync(filePath));
        const savedIds = idsGetter(savedResponse);
        let invalid = false;

        if (savedIds.length != targetIds.length) {
            invalid = true;
        } else {
            for (const targetId of targetIds) {
                if (!savedIds.includes(targetId)) {
                    invalid = true;
                    break;
                }
            }
        }

        if (!invalid) {
            response = savedResponse;
        }
    }

    if (response) {
        console.log(`Use saved response from '${filePath}'`);
        return response;
    } else {
        response = await getResponse(method, parameters);
        console.log(`Save response to '${filePath}'`);
        writeJson(filePath, response);
        return response;
    }
}

function getRandomIndex(array) {
    return Math.floor(Math.random() * array.length);
}

function getRandomEtag(length = 27) {
    const source = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomEtag = Array(length).fill(0).map(() => source[getRandomIndex(source)]).join('');
    return randomEtag;
}

async function main() {
    const dirname = path.dirname(process.argv[1]);

    // Check API Key
    if (process.argv.length < 3) {
        console.error(`Usage: node ${process.argv[1]} <API_KEY>`);
        return;
    } else {
        apiKey = process.argv[2];
        console.log(`API Key: ${apiKey}`);
    }

    // Read target videoIds
    let videoIds;
    const targetVideosPath = path.join(dirname, 'target-videos.json');

    if (fs.existsSync(targetVideosPath)) {
        videoIds = JSON.parse(fs.readFileSync(targetVideosPath));
    } else {
        console.error('Please make target-videos.json that contains the array of target videoId');
        return;
    }

    console.log();

    // Make videos-list
    createDir(dirname, 'videos-list');

    console.log('Target videoIds:', videoIds, '\n');

    const videosListAllPath = path.join(dirname, 'videos-list', 'all.json');
    const videosIdsGetter = response => response.items.map(video => video.id);
    const videosList = await getAndCacheResponse('videos', {
        part: ['id', 'snippet', 'contentDetails', 'statistics', 'player', 'localizations'],
        id: videoIds,
        hl: 'ko',
        maxResults: videoIds.length,
    }, videosListAllPath, videosIdsGetter, videoIds);

    // Make seperate videos-list
    for (const video of videosList.items) {
        const videosListPath = path.join(dirname, 'videos-list', video.id + '.json');

        if (!fs.existsSync(videosListPath)) {
            writeJson(videosListPath, {
                kind: 'youtube#videoListResponse',
                etag: getRandomEtag(),
                items: [video],
                pageInfo: {totalResults: 1, resultsPerPage: 1 },
            });
            console.log(`Save generated response for video '${video.id}' to '${videosListPath}'`);
        } else {
            console.log(`Generated response for video '${video.id}' already exists`);
        }
    }

    console.log();

    // Make channels-list
    createDir(dirname, 'channels-list');

    const channelIds = [...(new Set(videosList.items.map(item => item.snippet.channelId)))];
    console.log('Target channelIds:', channelIds, '\n');

    const channelsListAllPath = path.join(dirname, 'channels-list', 'all.json');
    const channelsIdsGetter = response => response.items.map(channel => channel.id);
    const channelsList = await getAndCacheResponse('channels', {
        part: ['id', 'snippet', 'contentDetails', 'statistics', 'status',
                'brandingSettings', 'contentOwnerDetails', 'localizations'],
        id: channelIds,
        hl: 'ko',
        maxResults: channelIds.length,
    }, channelsListAllPath, channelsIdsGetter, channelIds);

    // Make seperate channels-list
    for (const channel of channelsList.items) {
        const channelsListPath = path.join(dirname, 'channels-list', channel.id + '.json');

        if (!fs.existsSync(channelsListPath)) {
            writeJson(channelsListPath, {
                kind: 'youtube#channelListResponse',
                etag: getRandomEtag(),
                items: [channel],
                pageInfo: {totalResults: 1, resultsPerPage: 1},
            });
            console.log(`Save generated response for channel '${channel.id}' to '${channelsListPath}'`);
        } else {
            console.log(`Generated response for channel '${channel.id}' already exists`);
        }
    }

    console.log();

    // Make seperate search-list
    createDir(dirname, 'search-list');

    const maxSearchResults = Math.ceil(videoIds.length / 2);

    for (const videoId of videoIds) {
        const searchListPath = path.join(dirname, 'search-list', videoId + '.json');

        if (!fs.existsSync(searchListPath)) {
            const items = [];
            const usedIndex = new Set();
            for (let i = 0; i < maxSearchResults; i++) {
                let index = 0;
                do {
                    index = getRandomIndex(videosList.items);
                } while(usedIndex.has(index));
                usedIndex.add(index);

                const randomVideo = videosList.items[index];

                items.push({
                    kind: 'youtube#searchResult',
                    etag: getRandomEtag(),
                    id: {kind: 'youtube#video', videoId: randomVideo.id},
                    snippet: randomVideo.snippet
                })
            }

            writeJson(searchListPath, {
                kind: 'youtube#searchListResponse',
                etag: getRandomEtag(),
                regionCode: 'KR',
                pageInfo: {totalResults: items.length, resultsPerPage: items.length},
                items: items,
            });
            console.log(`Save generated response for search '${videoId}' to '${searchListPath}'`);
        } else {
            console.log(`Generated response for search '${videoId}' already exists`);
        }
    }

    console.log();

    // Make commentThreads-list
    createDir(dirname, 'commentThreads-list');

    for (const videoId of videoIds) {
        const commentThreadsListPath = path.join(dirname, 'commentThreads-list', videoId + '.json');
        const commentThreadsList = await getAndCacheResponse('commentThreads', {
            part: ['id', 'replies', 'snippet'],
            videoId: videoId,
            maxResults: 100,
            order: 'relevance',
        }, commentThreadsListPath, () => [], []);
    }

}


try {
    main();
} catch (error) {
    console.error(error);
}
