const relatedVideoBox = document.querySelector("#related-video-list");

const API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const API_KEY = "YOUR-API-KEY";

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
    console.log(queryString);
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

async function getComments(videoId) {
    const getCommentThread = DEMO ? await getDemoResponse(`demo/commentThreads-list/${videoId}.json`)
                            : await getResponse('commentThreads', {
                                part: ['snippet', 'replies'],
                                videoId: videoId,
                                maxResults: 100,
                                order: 'relevance' 
                            });
    const commentThread = getCommentThread.items;
    return commentThread;   
}

function createOneReply(reply) {
    const replyInfo = reply.snippet;

    const authorImage = replyInfo.authorProfileImageUrl;
    const authorName = replyInfo.authorDisplayName;
    const textDisplay = replyInfo.textDisplay;
    const commentLikeCount = replyInfo.likeCount;
    const commentDislikeCount = replyInfo.dislikeCount;
    const commentPublishedAt = replyInfo.publishedAt;
    const commentUpadatedAt = replyInfo.updatedAt;

    const replyHtml = `<div class="reply">
                        <div class="author-image"><img src="${authorImage}"></div>
                        <div class="comment-right">
                            <div class="author-info">
                                <span class="author-name">${authorName}</span>ㆍ<span class="publishedAt">${convertPublishedAt(commentPublishedAt)}</span><span class="updatedAt">${convertPublishedAt(commentUpadatedAt)}</span>
                            </div>
                            <div class="comment-text">${textDisplay}</div>
                            <div class="comment-info">
                                <div class="comment-info-left">
                                    <div><i class="far fa-thumbs-up"></i><span class="likeCount">${commentLikeCount == undefined ? '' : convertNumbers(commentLikeCount)}</span></div>
                                    <div><i class="far fa-thumbs-down"></i><span class="dislikeCount">${commentDislikeCount == undefined ? '' : convertNumbers(commentDislikeCount)}</span></div>
                                </div>
                                <div class="comment-menu"><i class="fas fa-ellipsis-v"></i></div>
                            </div>
                        </div>
                    </div>`
    return replyHtml;
}

function createReplyThread(replies) {
    const replieskeys = Object.keys(replies);

    const replyThread = [];
    for (let key of replieskeys) {
        const OneReply = createOneReply(replies[key]);
        replyThread.push(OneReply);
    }
    return replyThread.join('');
}

function createOneCommentThread(item) {
    const topLevelCommentInfo = item.snippet.topLevelComment.snippet;

    const authorImage = topLevelCommentInfo.authorProfileImageUrl;
    const authorName = topLevelCommentInfo.authorDisplayName;
    const textDisplay = topLevelCommentInfo.textDisplay;
    const commentLikeCount = topLevelCommentInfo.likeCount;
    const commentDislikeCount = topLevelCommentInfo.dislikeCount;
    const commentPublishedAt = topLevelCommentInfo.publishedAt;
    const commentUpadatedAt = topLevelCommentInfo.updatedAt;
    const totalReplyCount = item.snippet.totalReplyCount;

    let replyThread = '';
    let repliesText = '';
    if (item.replies !==  undefined) {
        const replies = item.replies.comments;
        replyThread = createReplyThread(replies);
        repliesText = `<div class="replies">답글 ${totalReplyCount}개&nbsp;<span class="repliesToggleText hide">보기</span></div>`;
    }

    const commentHtml = `<div class="comment">
                            <div class="author-image"><img src="${authorImage}"></div>
                            <div class="comment-right">
                                <div class="author-info">
                                    <span class="author-name">${authorName}</span>ㆍ<span class="publishedAt">${convertPublishedAt(commentPublishedAt)}</span><span class="updatedAt">${convertPublishedAt(commentUpadatedAt)}</span>
                                </div>
                                <div class="comment-text">${textDisplay}</div>
                                <div class="comment-info">
                                    <div class="comment-info-left">
                                        <div><i class="far fa-thumbs-up"></i><span class="likeCount">${commentLikeCount == undefined ? '' : convertNumbers(commentLikeCount)}</span></div>
                                        <div><i class="far fa-thumbs-down"></i><span class="dislikeCount">${commentDislikeCount == undefined ? '' : convertNumbers(commentDislikeCount)}</span></div>
                                        <div><i class="far fa-comment-dots"></i><span class="reply-number">${totalReplyCount == undefined ? '' : totalReplyCount}</span></div>
                                    </div>
                                    <div class="comment-menu"><i class="fas fa-ellipsis-v"></i></div>
                                </div>
                                    ${repliesText}
                                <div class="comment-thread hide">
                                    <div class="comment-thread-content">
                                        ${replyThread}
                                    </div>
                                </div>
                            </div>
                        </div>`
    return commentHtml;
}

function createCommentThread(obj) {
    const objkeys = Object.keys(obj);

    const thread = [];
    for (let key of objkeys) {
        const temp = createOneCommentThread(obj[key]);
        thread.push(temp);
    }
    return thread.join('');
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
        const commentCountE2 = document.getElementById('comments-number');

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
        commentCountE2.textContent = convertNumbers(commentCount);
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

function repliesToggleFunc(comment, button) {
    const repliesToggleTextSpan = button.getElementsByClassName('repliesToggleText')[0];
    const commentThread = comment.getElementsByClassName('comment-thread')[0];
    const commentThreadContent = commentThread.getElementsByClassName('comment-thread-content')[0];
    const commentThreadHeight = commentThreadContent.clientHeight;
    
    repliesToggleTextSpan.classList.toggle('hide');
    if(repliesToggleTextSpan.classList.contains('hide')) {
        repliesToggleTextSpan.textContent = '보기';
        commentThread.removeAttribute("style");
        
    } else {
        repliesToggleTextSpan.textContent = '숨기기';
        commentThread.setAttribute("style", `max-height: ${commentThreadHeight}px;`);
    }

}

function openComments() {
    const relatedVideoList = document.getElementById('related-video-list');
    relatedVideoList.setAttribute("style", 'display: none');
    
    
    const commentListBox = document.getElementById('comment-list-box');
    if (commentListBox.classList.contains('hide-list')) {
        commentListBox.classList.replace('hide-list', 'show-list');
    }
}

function closeComments() {
    const commentListBox = document.getElementById('comment-list-box');
    if (commentListBox.classList.contains('show-list')) {
        commentListBox.classList.replace('show-list', 'hide-list');
    }

    const relatedVideoList = document.getElementById('related-video-list');
    relatedVideoList.removeAttribute('style');

}

async function main(videoId) {
    moment.locale('ko');
    putMainViedoInfo(await getMainVideoInfo(videoId));
    const relatedVideoList = await getRelatedVideos(videoId);
    relatedVideoBox.innerHTML = relatedVideoList.map(x => createRelatedVideoHtml(x)).join('');
    
    const infoBox1 = document.getElementById('info-video-1');
    infoBox1.addEventListener('click', openDescription);

    const commentList = document.getElementById('comment-list');
    commentList.innerHTML = createCommentThread(await getComments(videoId));

    const commentRepliesToggle = document.getElementsByClassName('comment');
    for (let comment of commentRepliesToggle) {
        const repliesToggleButton = comment.getElementsByClassName('replies')[0];
        if (repliesToggleButton !== undefined) {
            repliesToggleButton.addEventListener('click', () => repliesToggleFunc(comment, repliesToggleButton));
        }
    }

    const bestComment = document.getElementById('best-comment');
    bestComment.addEventListener('click', openComments);
    const xButton = document.getElementById('close-comments');
    xButton.addEventListener('click', closeComments);
}

main('0-q1KafFCLU');
