const relatedVideoBox = document.querySelector("#related-video-list");

const API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const API_KEY = "AIzaSyAEYQm7sYB3usb7lah8vSwQVnpeJKvCmZc";

const DEMO = true;

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

    if (API_KEY === undefined) {
        throw new Error('API Key is empty');
    }

    const queryString = `${API_BASE_URL}/${method}?key=${API_KEY}&${parameterStrings.join('&')}`;

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

async function getDemoResponse(url) {
    const response = await fetch(url);
    return await response.json();
}







async function getMainVideoInfo(videoId) {

    const getVideoInfo = DEMO ? await getDemoResponse(`demo/videos-list/${videoId}.json`)
                            : await getResponse('videos', {
                                part: ['snippet', 'statistics', 'player'],
                                id: videoId
                            });
    const videoInfo = getVideoInfo.items[0];
    const channelId = videoInfo.snippet.channelId;
    
    const getChannelInfo = DEMO ? await getDemoResponse(`demo/channels-list/${channelId}.json`)
                            : await getResponse('channels', {
                                part: ['snippet', 'statistics'],
                                id: channelId
                            });
    
    const channelInfo = getChannelInfo.items[0];

    const mainVideoInfo = {
        'player': videoInfo.player.embedHtml,
        'title': videoInfo.snippet.title,
        'viewCount': videoInfo.statistics.viewCount,
        'publishedAt': videoInfo.snippet.publishedAt,
        'likeCount': videoInfo.statistics.likeCount,
        'dislikeCount': videoInfo.statistics.dislikeCount,
        'channelTumbnail': channelInfo.snippet.thumbnails.medium.url,
        'channelTitle': videoInfo.snippet.channelTitle,
        'channelSubscriberCount': channelInfo.statistics.subscriberCount,
        'description': videoInfo.snippet.description,
        'commentCount': videoInfo.statistics.commentCount,
    }

    return mainVideoInfo;
}


async function getRelatedVideos(videoId) {
    const searchList = DEMO ? await getDemoResponse(`demo/search-list/${videoId}.json`)
                            : await getResponse('search', {
                                part: ['snippet'],
                                relatedToVideoId: videoId,
                                type: 'video',
                                maxResults: 10
                            });
    const filteredItems = searchList.items.filter(item => "snippet" in item);

    const videoIds = filteredItems.map(item => item.id.videoId);
    const videosListP = DEMO ? getDemoResponse('demo/videos-list/all.json')
                             : getResponse('videos', {
                                 part: ['contentDetails', 'statistics'],
                                 id: videoIds,
                                 hl: 'ko',
                                 maxResults: videoIds.length
                             });

    const channelIds = filteredItems.map(item => item.snippet.channelId);
    const channelsListP = DEMO ? getDemoResponse('demo/channels-list/all.json')
                               : getResponse('channels', {
                                   part: ['snippet'],
                                   id: channelIds,
                                   hl: 'ko',
                                   maxResults: videoIds.length
                               });

    const videosMap = new Map(
        (await videosListP).items.map(item => [
            item.id, {
                'duration': item.contentDetails.duration,
                'viewCount': item.statistics.viewCount
            }
        ])
    );

    const channelsMap = new Map(
        (await channelsListP).items.map(item => [
            item.id, {
                'thumbnails': item.snippet.thumbnails.medium.url
            }
        ])
    );

    const relatedVideos = filteredItems.map(item => {
        const videoId = item.id.videoId;
        const channelId = item.snippet.channelId;
        const snippet = item.snippet;
        const videoItem = videosMap.get(videoId);
        const channelItem = channelsMap.get(channelId);
        return {
            'videoId': videoId,
            'title': snippet.title,
            'thumbnail': snippet.thumbnails.standard.url,
            'channelTitle': snippet.channelTitle,
            'publishedAt': snippet.publishedAt,
            'channelImage': channelItem.thumbnails,
            'duration': videoItem.duration,
            'viewCount': videoItem.viewCount
        };
    });

    return relatedVideos;
}

function convertNumbers(number) {
    const numString = number.toString();
    const numLength = numString.length;
    if (numLength >= 9) {
        return numString.slice(0, -8) + '.' + numString[numLength-8] + '억';
    } else if (numLength > 5) {
        return numString.slice(0,-4) + '만';
    } else if (numLength === 5) {
        return numString[0] + '.' + numString[1] + '만';
    } else if (numLength < 5) {
        return numString;
    }
}

function convertPublishedAt(publishedAt) {
    return moment(publishedAt).fromNow();
}

function convertDuration(duration) {
    const mduration = moment.duration(duration);
    const days = mduration.days();
    const hours = mduration.hours();
    const minutes = mduration.minutes();
    const seconds = mduration.seconds();

    const pad = num => num.toString().padStart(2, '0');

    if (days > 0) {
        return `${days}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    } else if (hours > 0) {
        return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    } else {
        return `${minutes}:${pad(seconds)}`;
    }
}

function createRelatedVideoHtml({
    videoId,
    title,
    thumbnail,
    channelTitle,
    publishedAt,
    channelImage,
    duration,
    viewCount
}) {
    const relatedVideoHtml = `
        <div class="rv">
            <div class="rv-thumb">
                <div class="hover-buttons">
                    <div class="watch-later">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div class="add-to-list">
                        <i class="fas fa-stream"></i>
                    </div>
                </div>
                <div class="playtime">
                    <span>${convertDuration(duration)}</span>
                </div>
                <div class="thumb">
                    <img class="thumb-standard" src="${thumbnail}" alt="">
                </div>
            </div>
            <div class="rv-info">
                <div class="video-info">
                    <div class="channel-image">
                        <img src="${channelImage}" alt="">
                    </div>
                    <div class="video-info-right">
                        <div class="video-info-up">
                            <div class="title">${title}</div>
                            <div class="more"><i class="fas fa-ellipsis-v"></i></div>
                        </div>
                        <div class="view-upload">
                            <span class="channel-name">${channelTitle}</span><span class="active">ㆍ</span><span class="active-block">조회수 ${convertNumbers(viewCount)}회ㆍ${convertPublishedAt(publishedAt)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    return relatedVideoHtml;
}

function putMainViedoInfo({
    player,
    title, 
    viewCount, 
    publishedAt, 
    likeCount, 
    dislikeCount,
    channelTumbnail, 
    channelTitle, 
    channelSubscriberCount,
    description, 
    commentCount}) {
        const playerE = document.getElementById('nowplaying');
        const titleE = document.getElementById('title'); 
        const viewCountE = document.getElementsByClassName('view-count info-video-1')[0];
        const publishedAtE = document.getElementsByClassName('publish-time info-video-1')[0]; 
        const likeCountE = document.getElementById('likes'); 
        const dislikeCountE = document.getElementById('dislikes'); 
        const channelTumbnailE = document.getElementById('channel-image');
        const channelTitleE = document.getElementById('name'); 
        const channelSubscriberCountE = document.getElementById('subscribers'); 
        const descriptionE = document.getElementById('description');
        const commentCountE = document.getElementById('comments-info-number');

        description = description.replace(/(www|http:|https:)+[^\s]+[\w]/g, string => `<a href="${string}", target="_blank">${string}</a>`);
        description = description.replace(/\n/g, '</br>');
        const taglist = [];
        description = description.replace(/#{1}[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]+/g, string => {
                taglist.push(`<a href="#">${string}</a>`);
                return `<a href="#">${string}</a>`;
        });
        document.getElementById('tags').innerHTML = taglist.slice(0,3).join(' ');

        playerE.innerHTML = player;
        titleE.textContent = title;
        viewCountE.textContent = '조회수 ' + convertNumbers(viewCount) + '회';
        publishedAtE.textContent = convertPublishedAt(publishedAt);
        likeCountE.textContent = convertNumbers(likeCount);
        dislikeCountE.textContent = convertNumbers(dislikeCount);
        channelTumbnailE.innerHTML = `<img src='${channelTumbnail}'>`;
        channelTitleE.textContent = channelTitle;
        channelSubscriberCountE.textContent = '구독자 ' + convertNumbers(channelSubscriberCount) + '명';
        descriptionE.innerHTML = description;
        commentCountE.textContent = convertNumbers(commentCount);
    }

function openDescription() {
    const descriptionBox = document.getElementById('description-box');
    const infoChannel = document.getElementById('info-channel');
    const description = document.getElementById('description');
    const descriptionHeight = description.clientHeight;

    infoChannel.classList.toggle('borderO');
    infoChannel.classList.toggle('borderX');
    if (descriptionBox.hasAttribute("style")) {
        descriptionBox.removeAttribute("style");
    } else {
        descriptionBox.setAttribute("style", `max-height: ${descriptionHeight}px;`);
    }


    const arrow = document.getElementsByClassName('fa-chevron-down')[0];
    arrow.classList.toggle('arrowup');
}

async function main() {
    moment.locale('ko');
    putMainViedoInfo(await getMainVideoInfo('0-q1KafFCLU'));
    const relatedVideoList = await getRelatedVideos('0-q1KafFCLU');
    relatedVideoBox.innerHTML = relatedVideoList.map(x => createRelatedVideoHtml(x)).join('');
    
    const infoBox1 = document.getElementById('info-video-1');
    infoBox1.addEventListener('click', openDescription);
}

main();
