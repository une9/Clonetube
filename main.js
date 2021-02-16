const API_BASE_URL = "https://www.googleapis.com/youtube/v3";
let apiKey; // = "YOUR-API-KEY";

const DEMO_VIDEO_LIST = [
    '-5q5mZbe3V8', '0-q1KafFCLU', '3iM_06QeZi8', '3l5jwqPT2yk', 'CN4fffh7gmk',
    'D1PvIWdJ8xo', 'ez51zZrq744', 'gdZLi9oWNZg', 'LXOJk2PFKgY', 'm3DZsBw5bnE',
    'TgOu00Mf3kI', 'XsX3ATc3FbA', 'zJCdkOpU90g'
];

async function getResponse(method, parameters, demoFallback) {
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

    let queryString;
    if (apiKey) {
        queryString = `${API_BASE_URL}/${method}?key=${apiKey}&${parameterStrings.join('&')}`;
    } else {
        queryString = demoFallback;
    }

    try {
        const response = await fetch(queryString);
        if (response.ok) {
            return await response.json();
        } else {
            throw new Error(`Response code ${response.status}`);
        }
    } catch (error) {
        alert('Data fetch failed!\nCheck your API key and the video ID are correct.');
        throw new Error(error.message);
    }
}

async function getMainVideoInfo(videoId) {
    const getVideoInfo = await getResponse('videos', {
                                   part: ['snippet', 'statistics', 'player'],
                                   id: videoId
                               }, demoFallback = `demo/videos-list/${videoId}.json`);
    const videoInfo = getVideoInfo.items[0];
    const channelId = videoInfo.snippet.channelId;

    const getChannelInfo = await getResponse('channels', {
                                     part: ['snippet', 'statistics'],
                                     id: channelId
                                 }, demoFallback = `demo/channels-list/${channelId}.json`);
    const channelInfo = getChannelInfo.items[0];

    const mainVideoInfo = {
        'player': videoInfo.player.embedHtml,
        'title': videoInfo.snippet.title,
        'viewCount': videoInfo.statistics.viewCount,
        'publishedAt': videoInfo.snippet.publishedAt,
        'likeCount': videoInfo.statistics.likeCount,
        'dislikeCount': videoInfo.statistics.dislikeCount,
        'channelId': channelId,
        'channelTumbnail': channelInfo.snippet.thumbnails.medium.url,
        'channelTitle': videoInfo.snippet.channelTitle,
        'channelSubscriberCount': channelInfo.statistics.subscriberCount,
        'description': videoInfo.snippet.description,
        'commentCount': videoInfo.statistics.commentCount,
    }

    return mainVideoInfo;
}


async function getRelatedVideos(videoId) {
    const searchList = await getResponse('search', {
                                 part: ['snippet'],
                                 relatedToVideoId: videoId,
                                 type: 'video',
                                 maxResults: 10
                             }, demoFallback = `demo/search-list/${videoId}.json`);
    const filteredItems = searchList.items.filter(item => "snippet" in item);

    const videoIds = filteredItems.map(item => item.id.videoId);
    const videosListP = getResponse('videos', {
                            part: ['contentDetails', 'statistics'],
                            id: videoIds,
                            hl: 'ko',
                            maxResults: videoIds.length
                        }, demoFallback = 'demo/videos-list/all.json');

    const channelIds = filteredItems.map(item => item.snippet.channelId);
    const channelsListP =  getResponse('channels', {
                               part: ['snippet'],
                               id: channelIds,
                               hl: 'ko',
                               maxResults: videoIds.length
                           }, demoFallback = 'demo/channels-list/all.json');

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
            'viewCount': videoItem.viewCount,
            'channelId': channelId
        };
    });

    return relatedVideos;
}

async function getComments(videoId) {
    const getCommentThread = await getResponse('commentThreads', {
                                       part: ['snippet', 'replies'],
                                       videoId: videoId,
                                       maxResults: 100,
                                       order: 'relevance'
                                   }, demoFallback = `demo/commentThreads-list/${videoId}.json`);
    const commentThread = getCommentThread.items;
    return commentThread;
}

function createOneReply(reply) {
    const replyInfo = reply.snippet;

    const authorImage = replyInfo.authorProfileImageUrl;
    const authorName = replyInfo.authorDisplayName;
    const textDisplay = replyInfo.textDisplay.replace(/@{1}[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]+/, string => `<span class='mention'>${string}</span>`);
    const commentLikeCount = replyInfo.likeCount;
    const commentDislikeCount = replyInfo.dislikeCount;
    const commentPublishedAt = replyInfo.publishedAt;
    const commentUpadatedAt = replyInfo.updatedAt;

    const replyHtml = `
    <div class="reply">
        <div class="author-image">
            <img src="${authorImage}">
        </div>
        <div class="comment-right">
            <div class="author-info">
                <span class="author-name">${authorName}</span>
                ㆍ
                <span class="publishedAt">${convertPublishedAt(commentPublishedAt)}</span>
                <span class="updatedAt">${commentPublishedAt !== commentUpadatedAt ? ' (수정됨)' : ''}</span>
            </div>
            <div class="reply-text">${textDisplay}</div>
            <div class="comment-info">
                <div class="comment-info-left">
                    <div>
                        <i class="far fa-thumbs-up"></i>
                        <span class="likeCount">${commentLikeCount ? convertNumbers(commentLikeCount) : ''}</span>
                    </div>
                    <div>
                        <i class="far fa-thumbs-down"></i>
                        <span class="dislikeCount">${commentDislikeCount ? convertNumbers(commentDislikeCount) : ''}</span>
                    </div>
                </div>
                <div class="comment-menu">
                    <i class="fas fa-ellipsis-v"></i>
                </div>
            </div>
        </div>
    </div>`;
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

    const commentHtml = `
    <div class="comment">
        <div class="author-image"><img src="${authorImage}"></div>
        <div class="comment-right">
            <div class="author-info">
                <span class="author-name">${authorName}</span>
                ㆍ
                <span class="publishedAt">${convertPublishedAt(commentPublishedAt)}</span>
                <span class="updatedAt">${commentPublishedAt !== commentUpadatedAt ? ' (수정됨)' : ''}</span>
            </div>
            <div class="comment-text">
                <div class="ctContent">${textDisplay}</div>
                <span class="ell"></span>
            </div>
            <div class="comment-info">
                <div class="comment-info-left">
                    <div>
                        <i class="far fa-thumbs-up"></i>
                        <span class="likeCount">${commentLikeCount ? convertNumbers(commentLikeCount) : ''}</span>
                    </div>
                    <div>
                        <i class="far fa-thumbs-down"></i>
                        <span class="dislikeCount">${commentDislikeCount ? convertNumbers(commentDislikeCount) : ''}</span>
                    </div>
                    <div>
                        <i class="far fa-comment-dots"></i>
                        <span class="reply-number">${totalReplyCount ? totalReplyCount : ''}</span>
                    </div>
                </div>
                <div class="comment-menu">
                    <i class="fas fa-ellipsis-v"></i>
                </div>
            </div>
                ${repliesText}
            <div class="comment-thread hide">
                <div class="comment-thread-content">
                    ${replyThread}
                </div>
            </div>
        </div>
    </div>`;
    return commentHtml;
}

function createBestComment(obj) {
    const bestCommentImgE = document.getElementById('best-comment-image');
    const bestCommentTextE = document.getElementById('best-comment-text');

    const bestCommentImg = obj.authorProfileImageUrl;
    const bestCommentText = obj.textDisplay;

    bestCommentImgE.innerHTML = `<img src="${bestCommentImg}">`;
    bestCommentTextE.innerHTML = bestCommentText;
}

function createCommentThread(obj) {
    const objkeys = Object.keys(obj);
    createBestComment(obj[objkeys[0]].snippet.topLevelComment.snippet);

    const thread = [];
    for (let key of objkeys) {
        let temp = createOneCommentThread(obj[key]);
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
    viewCount,
    channelId
}) {
    const relatedVideoHtml = `
        <li class="rv">
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
                    <div>${convertDuration(duration)}</div>
                </div>
                <figure class="thumb">
                    <img class="thumb-standard" src="${thumbnail}" alt="${title}" onclick="main('${videoId}')">
                </figure>
            </div>
            <div class="rv-info">
                <div class="video-info">
                    <div class="channel-image">
                        <a href="https://www.youtube.com/channel/${channelId}" target="_blank">
                            <img src="${channelImage}" alt="">
                        </a>
                    </div>
                    <div class="video-info-right">
                        <div class="video-info-up">
                            <div class="title" onclick="main('${videoId}')">${title}</div>
                            <div class="more">
                                <i class="fas fa-ellipsis-v"></i>
                            </div>
                        </div>
                        <div class="view-upload">
                            <a href="https://www.youtube.com/channel/${channelId}" target="_blank">
                                <span class="channel-name">${channelTitle}</span>
                            </a>
                            <span class="active">ㆍ</span>
                            <span class="active-block">조회수 ${convertNumbers(viewCount)}회ㆍ${convertPublishedAt(publishedAt)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </li>`;
    return relatedVideoHtml;
}

function putMainViedoInfo({
    player,
    title,
    viewCount,
    publishedAt,
    likeCount,
    dislikeCount,
    channelId,
    channelTumbnail,
    channelTitle,
    channelSubscriberCount,
    description,
    commentCount
}) {
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
    description = description.replace(/#{1}[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9|_]+/g, string => {
            const replaced = `<a href="https://www.youtube.com/hashtag/${string.slice(1)}" target="_blank">${string}</a>`;
            taglist.push(replaced);
            return replaced;
    });
    document.getElementById('tags').innerHTML = taglist.slice(0,3).join(' ');

    playerE.innerHTML = player;
    titleE.textContent = title;
    viewCountE.textContent = '조회수 ' + convertNumbers(viewCount) + '회';
    publishedAtE.textContent = convertPublishedAt(publishedAt);
    likeCountE.textContent = convertNumbers(likeCount);
    dislikeCountE.textContent = convertNumbers(dislikeCount);
    channelTumbnailE.innerHTML = `<a href="https://www.youtube.com/channel/${channelId}" target="_blank"><img src='${channelTumbnail}'></a>`;
    channelTitleE.innerHTML = `<a href="https://www.youtube.com/channel/${channelId}" target="_blank">${channelTitle}</a>`;
    channelSubscriberCountE.textContent = '구독자 ' + convertNumbers(channelSubscriberCount) + '명';
    descriptionE.innerHTML = description;
    commentCountE.textContent = convertNumbers(commentCount);
    commentCountE2.textContent = convertNumbers(commentCount);
}

function openDescription() {
    const widthCheck = matchMedia('screen and (min-width: 1024px)');
    const descriptionBox = document.getElementById('description-box');

    if (widthCheck.matches) {
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
    } else {
        descriptionBox.classList.add('mobile');

        const relatedVideoList = document.getElementById('related-video-list');
        relatedVideoList.setAttribute("style", 'display: none');
        const descriptionHeader = document.getElementById('description-header');
        descriptionHeader.classList.add('visible');
        const descriptionCloseButton = descriptionHeader.getElementsByTagName('i')[0];
        descriptionCloseButton.addEventListener('click', () => {
            relatedVideoList.removeAttribute("style");

            descriptionBox.classList.add('slide-out');
            setTimeout(() => {
                descriptionHeader.classList.remove('visible');
                descriptionBox.classList.remove('slide-out');
                descriptionBox.classList.remove('mobile');
            }, 300);
        })
    }
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
    const relatedVideoList = document.getElementById('related-video-list');
    relatedVideoList.removeAttribute('style');

    const commentListBox = document.getElementById('comment-list-box');
    if (commentListBox.classList.contains('show-list')) {
        commentListBox.classList.add('slide-out');
        setTimeout(() => {
            commentListBox.classList.remove('slide-out');
            commentListBox.classList.replace('show-list', 'hide-list');
        }, 300);
    }
}

function removeEllipsis([commentTextContent, ell]) {
    commentTextContent.classList.remove('ellipsis-check');
    ell.innerText = '';
    ell.removeAttribute('style');
    commentTextContent.setAttribute("style", 'display: block');
}

function commentEllipsisCheck(commentTextE) {
    const commentTextContent = commentTextE.getElementsByClassName('ctContent')[0];
    const ell = commentTextE.getElementsByClassName('ell')[0];

    const originHeight = commentTextContent.clientHeight;
    commentTextContent.classList.add('ellipsis-check');
    const ellipsisHeight = commentTextContent.clientHeight;

    if (originHeight > ellipsisHeight) {
        ell.innerText = '자세히 보기';
        ell.setAttribute('style', 'padding-top: 0.5rem; display: inline-block');
        ell.addEventListener('click', () => removeEllipsis([commentTextContent, ell]));
    } else {
        commentTextContent.classList.remove('ellipsis-check');
    }
    return commentTextE;
}

function resizeHandler([commentListBox, relatedVideoList]) {
    const m = matchMedia('screen and (min-width: 1024px)');
    const descriptionBox = document.getElementById('description-box');
    const descriptionHeader = document.getElementById('description-header');
    const infoChannel = document.getElementById('info-channel');
    if (m.matches) {
        commentListBox.classList.replace('show-list', 'hide-list');
        relatedVideoList.removeAttribute('style');

        descriptionBox.classList.remove('mobile');
        descriptionHeader.classList.remove('visible');
    } else if (!m.matches) {
        descriptionBox.removeAttribute('style');
        infoChannel.classList.remove('borderO');
        infoChannel.classList.add('borderX');

        relatedVideoList.removeAttribute('style');
    }
}

async function main(videoId) {
    moment.locale('ko');
    putMainViedoInfo(await getMainVideoInfo(videoId));
    const relatedVideoListInfo = await getRelatedVideos(videoId);
    const relatedVideoBox = document.getElementById("related-video-list");
    relatedVideoBox.innerHTML = relatedVideoListInfo.map(x => createRelatedVideoHtml(x)).join('');

    const infoBox1 = document.getElementById('info-video-1');
    infoBox1.addEventListener('click', openDescription);

    const commentList = document.getElementById('comment-list');
    commentList.innerHTML = createCommentThread(await getComments(videoId));

    const topLevelComments = document.getElementsByClassName('comment-text');
    const commentListBox = document.getElementById('comment-list-box');
    commentListBox.setAttribute('style', 'display: block');
    for (let commentTextE of topLevelComments) {
        commentTextE = commentEllipsisCheck(commentTextE);
    }
    commentListBox.removeAttribute('style');

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

    const relatedVideoList = document.getElementById('related-video-list');
    window.addEventListener('resize', () => resizeHandler([commentListBox, relatedVideoList]));
}

function getRandomDemoVideoId() {
    const randomNumber = Math.floor(Math.random() * DEMO_VIDEO_LIST.length);
    return DEMO_VIDEO_LIST[randomNumber];
}

function queryVideoId() {
    const queries = window.location.search.substr(1).split('&');
    let videoId;

    for (const query of queries) {
        const [key, value] = query.split('=', 2);
        if (key === 'v') {
            videoId = value;
        } else if (key === 'api_key') {
            apiKey = value;
        }
    }

    if (videoId) {
        return videoId;
    } else {
        videoId = getRandomDemoVideoId();
        document.location = `?v=${videoId}`;
        return videoId;
    }
}

const videoId = queryVideoId();

if (!DEMO_VIDEO_LIST.includes(videoId) && !apiKey) {
    const message = 'You are trying to access a video that is not included in the demo data. '
                  + 'If you want to use real Youtube Data API, please put your API key. '
                  + 'Otherwise, you will be redirected to one of the demo videos.\n\n'
                  + 'Your API key:';
    apiKey = prompt(message);

    if (!apiKey) {
        document.location = `?v=${getRandomDemoVideoId()}`;
    }
}

main(videoId);

// main('0-q1KafFCLU');


'm3DZsBw5bnE'
