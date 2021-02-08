const relatedVideoBox = document.querySelector("#related-video-list");

const API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const API_KEY = "PUT-YOUR-API-KEY";

const DEBUG = true;

async function getRelatedVideos(videoId) {
    const searchListQuery = `${API_BASE_URL}/search?key=${API_KEY}&part=snippet&relatedToVideoId=${videoId}&type=video&maxResults=10`;
    const searchListResponse = await fetch(DEBUG ? "debug/search-list.json" : searchListQuery);
    const searchList = await searchListResponse.json();
    const filteredItems = searchList.items.filter(item => "snippet" in item);

    const videoIds = filteredItems.map(item => item.id.videoId).join('%2C');
    const videosListQuery = `${API_BASE_URL}/videos?key=${API_KEY}&part=statistics%2CcontentDetails&id=${videoIds}`;
    const videosListResponsePromise = fetch(DEBUG ? "debug/videos-list.json" : videosListQuery);

    const channelIds = filteredItems.map(item => item.snippet.channelId).join('%2C');
    const channelsListQuery = `${API_BASE_URL}/channels?key=${API_KEY}&part=snippet&id=${channelIds}`;
    const channelsListResponsePromise = fetch(DEBUG ? "debug/channels-list.json" : channelsListQuery);

    const videosListResponse = await videosListResponsePromise;
    const channelsListResponse = await channelsListResponsePromise;
    
    const videosList = await videosListResponse.json();
    const videosMap = new Map(
        videosList.items.map(item => [
            item.id, {
                'duration': item.contentDetails.duration,
                'viewCount': item.statistics.viewCount
            }
        ])
    );

    const channelsList = await channelsListResponse.json();
    const channelsMap = new Map(
        channelsList.items.map(item => [
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
            'publishTime': snippet.publishTime,
            'channelImage': channelItem.thumbnails,
            'duration': videoItem.duration,
            'viewCount': videoItem.viewCount
        };
    });

    return relatedVideos;
}

function convertViewCount(viewCount) {
    const viewString = viewCount.toString();
    const viewLength = viewString.length;
    if (viewLength >= 9) {
        return viewString.slice(0, -8) + '.' + viewString[viewLength-8] + '억';
    } else if (viewLength === 8) {
        return viewString[0] + '천만';
    } else if (viewLength > 5) {
        return viewString.slice(0,-4) + '만';
    } else if (viewLength === 5) {
        return viewString[0] + '.' + viewString[1] + '만';
    } else if (viewLength < 5) {
        return viewString;
    }
}

function convertPublishTime(publishTime) {
    return moment(publishTime).fromNow();
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
    publishTime,
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
                            <div class="channel-name">${channelTitle}</div>
                            <span class="active">ㆍ</span> 
                            <div class="active-block">
                                <div class="view-count">조회수 ${convertViewCount(viewCount)}회</div>
                                ㆍ
                                <div class="publish-time">${convertPublishTime(publishTime)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    return relatedVideoHtml;
}


async function main() {
    moment.locale('ko');
    const relatedVideoList = await getRelatedVideos('gdZLi9oWNZg');
    relatedVideoBox.innerHTML = relatedVideoList.map(x => createRelatedVideoHtml(x)).join('');
}

main();