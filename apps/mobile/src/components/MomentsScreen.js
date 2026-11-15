import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Image, Keyboard, Modal, PanResponder, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Directory, File, Paths } from 'expo-file-system';
import { ApiRoute } from '@cloudcomai/api-client';
import { buildApiUrl } from '../utils/media';
import { API_BASE_URL, platformApi, sessionManager, uploadMobileFile } from '../services/platform';
import { resolveChatTheme } from '../services/chatTheme';

const PHOTO_MAX_BYTES = 12 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const VIDEO_MAX_SECONDS = 90;
const TEXT_MAX_LENGTH = 500;

const MOMENT_EMOJI_CATEGORIES = [
  { name: 'Smileys & People', icon: '😊', emojis: '😀 😃 😄 😁 😆 😅 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 🤗 🤭 🤔 😐 😏 🙄 😴 😷 🤒 🤢 🥵 🥶 😎 🥳 😕 😟 😢 😭 😱 😡 🤬 😈 💀 👻 👽 🤖 👋 👍 👎 👏 🙌 🫶 🙏 💪 👀 👄 💅' },
  { name: 'Animals & Nature', icon: '🐻', emojis: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦅 🦉 🐺 🐴 🦄 🐝 🦋 🐌 🐞 🐜 🕷️ 🦂 🐢 🐍 🦎 🦖 🐙 🦑 🦐 🦀 🐠 🐟 🐬 🦈 🐳 🐊 🐅 🐆 🦓 🦍 🐘 🦛 🦏 🐪 🦒 🦘 🦬 🐄 🐎 🐖 🐑 🦙 🐐 🦌 🐕 🐈 🐇 🦝 🦦 🐿️ 🌵 🌲 🌴 🌱 🌿 🍀 🍃 🍂 🍁 🍄 🌷 🌹 🥀 🌺 🌸 🌼 🌻' },
  { name: 'Food & Drink', icon: '🍕', emojis: '🍇 🍈 🍉 🍊 🍋 🍌 🍍 🥭 🍎 🍐 🍑 🍒 🍓 🫐 🥝 🍅 🫒 🥥 🥑 🍆 🥔 🥕 🌽 🌶️ 🥒 🥬 🥦 🧄 🧅 🥜 🍞 🥐 🥖 🥨 🥯 🥞 🧇 🧀 🍖 🍗 🥩 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥙 🥚 🍳 🥘 🍲 🥗 🍿 🍱 🍙 🍚 🍛 🍜 🍝 🍣 🍤 🥟 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🍫 🍬 🍭 ☕ 🍵 🧋 🥤 🧃 🍷 🍸 🍹 🍺 🥂' },
  { name: 'Activities', icon: '⚽', emojis: '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🏓 🏸 🏒 🏑 🏏 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 ⛸️ 🥌 🎿 ⛷️ 🏂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🚣 🚴 🏆 🥇 🥈 🥉 🏅 🎖️ 🎫 🎪 🤹 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🎻 🎲 ♟️ 🎯 🎳 🎮 🧩' },
  { name: 'Travel & Places', icon: '🚗', emojis: '🚗 🚕 🚙 🚌 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚜 🛵 🏍️ 🚲 🛴 🚏 🛣️ ⛽ ⚓ ⛵ 🚤 🚢 ✈️ 🛫 🛬 🚁 🚀 🛸 🌍 🌎 🌏 🗺️ 🧭 🏔️ ⛰️ 🌋 🏕️ 🏖️ 🏜️ 🏝️ 🏞️ 🏟️ 🏛️ 🏗️ 🏘️ 🏠 🏡 🏢 🏥 🏨 🏫 🏬 🏭 🏯 🏰 💒 🗼 🗽 ⛪ 🕌 🛕 🕍 ⛩️ ⛲ 🌃 🌄 🌅 🌆 🌇 🌉' },
  { name: 'Objects', icon: '💡', emojis: '⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💽 💾 💿 📷 📸 📹 🎥 📞 ☎️ 📺 📻 🎙️ ⏰ ⌛ 🔋 🔌 💡 🔦 🕯️ 💸 💵 💶 💷 💰 💳 💎 🔧 🔨 🛠️ ⚙️ 🧲 🔫 💣 🔪 🛡️ 🔮 📿 🧿 🔬 🧪 🧬 💊 💉 🩹 🧹 🧺 🚽 🚿 🛁 🧼 🪥 🔑 🚪 🪑 🛋️ 🛏️ 🧸 🖼️ 🛍️ 🛒 🎁 🎈 🎀 🎉 ✉️ 📧 💌 📦 📚 📖 📝 ✏️ 🖊️ 🔍 🔒 🔓' },
  { name: 'Symbols', icon: '💯', emojis: '❤️ 🧡 💛 💚 💙 🩵 💜 🤎 🖤 🩶 🤍 💔 ❤️‍🔥 ❤️‍🩹 💕 💞 💓 💗 💖 💘 💝 💟 ❣️ 💯 💢 💥 💫 💦 💨 💬 💭 💤 🔔 🔕 🎵 🎶 ♿ ⚠️ 🚫 ⛔ 🚭 🔞 ☢️ ☣️ ⬆️ ➡️ ⬇️ ⬅️ ↔️ ↕️ 🔃 🔄 ▶️ ⏸️ ⏹️ ➕ ➖ ➗ ✖️ ♾️ ‼️ ⁉️ ❓ ❗ ♻️ 🔰 🔱 🆕 🆒 🆓 ℹ️ 🆘 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🔶 🔷' },
  { name: 'Flags', icon: '🏳️', emojis: '🏁 🚩 🎌 🏴 🏳️ 🏳️‍🌈 🏳️‍⚧️ 🏴‍☠️ 🇮🇳 🇺🇸 🇬🇧 🇨🇦 🇦🇺 🇳🇿 🇫🇷 🇩🇪 🇮🇹 🇪🇸 🇫🇮 🇯🇵 🇨🇳 🇰🇷 🇧🇷 🇲🇽 🇿🇦 🇸🇬 🇦🇪 🇸🇦 🇵🇰 🇱🇰 🇳🇵 🇧🇩 🇶🇦 🇹🇷 🇺🇦 🇷🇺 🇵🇹 🇳🇱 🇸🇪 🇳🇴 🇩🇰 🇮🇪 🇬🇷 🇹🇭 🇮🇩 🇲🇾 🇵🇭 🇻🇳 🇪🇬 🇳🇬 🇰🇪 🇦🇷 🇨🇱 🇨🇴 🇵🇪 🇨🇺 🇯🇲 🇺🇳' },
];

const MOMENT_EMOJI_KEYWORDS = {
  '😀': 'grinning smile happy', '😂': 'joy laugh tears funny', '🥰': 'love hearts affection', '😍': 'heart eyes love', '😊': 'smile happy', '😉': 'wink', '😎': 'cool sunglasses', '🥳': 'party celebration', '😭': 'cry sad tears', '😡': 'angry mad', '🤔': 'thinking', '😴': 'sleep tired', '❤️': 'heart love red', '💔': 'broken heart', '💕': 'hearts love', '👍': 'thumbs up like approve', '👎': 'thumbs down dislike', '🙏': 'pray thanks please', '👏': 'clap applause', '🔥': 'fire hot', '✨': 'sparkles', '🎉': 'party celebration', '🎂': 'birthday cake', '🌹': 'rose flower', '🌻': 'sunflower', '🐶': 'dog puppy', '🐱': 'cat kitten', '🐼': 'panda', '🦁': 'lion', '🐸': 'frog', '🦋': 'butterfly', '🐝': 'bee', '🐬': 'dolphin', '🍎': 'apple fruit', '🍕': 'pizza food', '🍔': 'burger food', '🍟': 'fries food', '🍩': 'donut dessert', '☕': 'coffee drink', '🍵': 'tea drink', '🚗': 'car vehicle', '✈️': 'airplane flight', '🚀': 'rocket space', '🏠': 'house home', '🏖️': 'beach holiday', '⚽': 'soccer football', '🏀': 'basketball', '🎮': 'game gaming', '🎵': 'music note', '🎸': 'guitar music', '💡': 'light bulb idea', '📱': 'phone mobile', '💻': 'computer laptop', '🎁': 'gift present', '🇮🇳': 'india flag', '🇺🇸': 'usa america flag', '🇬🇧': 'uk britain flag', '🇨🇦': 'canada flag', '🇦🇺': 'australia flag',
};

function MomentAuthorAvatar({ userId, name, size = 48, token }) {
  const [failed, setFailed] = useState(false);
  const initials = String(name || 'User').trim().charAt(0).toUpperCase() || 'U';
  const avatarUri = Number(userId) > 0
    ? buildApiUrl(API_BASE_URL, ApiRoute.MEDIA, { type: 'user', id: Number(userId) })
    : '';

  useEffect(() => { setFailed(false); }, [userId, avatarUri]);

  return (
    <View style={[styles.authorAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {avatarUri && !failed ? (
        <Image
          source={{ uri: avatarUri, ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.authorAvatarInitial, { fontSize: Math.max(14, Math.round(size * 0.42)) }]}>{initials}</Text>
      )}
    </View>
  );
}

function MomentVideo({ uri, token, paused, onFinish }) {
  const player = useVideoPlayer({ uri, headers: token ? { Authorization: `Bearer ${token}` } : {} }, instance => {
    instance.loop = false;
  });
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [player, paused]);
  useEffect(() => {
    const subscription = player.addListener('playToEnd', onFinish);
    return () => {
      subscription.remove();
      try { player.pause(); } catch {}
    };
  }, [player, onFinish]);
  return <VideoView player={player} style={styles.viewerMedia} nativeControls={false} contentFit="cover" />;
}

function MomentPhoto({ story, token }) {
  const [localUri, setLocalUri] = useState('');
  const [mediaError, setMediaError] = useState(false);
  const zoomScale = React.useRef(new Animated.Value(1)).current;
  const zoomScaleValue = React.useRef(1);
  const panX = React.useRef(new Animated.Value(0)).current;
  const panY = React.useRef(new Animated.Value(0)).current;
  const panXValue = React.useRef(0);
  const panYValue = React.useRef(0);
  const pinchGesture = React.useRef({ initialDistance: 0, initialScale: 1, startX: 0, startY: 0 });
  const photoPanResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: event => (event.nativeEvent.touches || []).length > 1 || zoomScaleValue.current > 1,
    onMoveShouldSetPanResponder: event => (event.nativeEvent.touches || []).length > 1 || zoomScaleValue.current > 1,
    onPanResponderGrant: event => {
      const touches = event.nativeEvent.touches || [];
      const distance = touches.length > 1 ? Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY) : 0;
      pinchGesture.current = { initialDistance: distance, initialScale: zoomScaleValue.current, startX: panXValue.current, startY: panYValue.current };
    },
    onPanResponderMove: (event, gestureState) => {
      const touches = event.nativeEvent.touches || [];
      if (touches.length > 1) {
        const distance = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
        const nextScale = Math.max(1, Math.min(4, pinchGesture.current.initialScale * (distance / Math.max(1, pinchGesture.current.initialDistance))));
        zoomScaleValue.current = nextScale;
        zoomScale.setValue(nextScale);
        if (nextScale === 1) { panXValue.current = 0; panYValue.current = 0; panX.setValue(0); panY.setValue(0); }
      } else if (zoomScaleValue.current > 1) {
        const nextX = pinchGesture.current.startX + gestureState.dx;
        const nextY = pinchGesture.current.startY + gestureState.dy;
        panXValue.current = nextX; panYValue.current = nextY;
        panX.setValue(nextX); panY.setValue(nextY);
      }
    },
    onPanResponderRelease: () => { pinchGesture.current.initialDistance = 0; },
    onPanResponderTerminate: () => { pinchGesture.current.initialDistance = 0; },
    onPanResponderTerminationRequest: () => false,
  }), []);

  useEffect(() => {
    zoomScaleValue.current = 1; panXValue.current = 0; panYValue.current = 0;
    zoomScale.setValue(1); panX.setValue(0); panY.setValue(0);
  }, [story.id]);

  useEffect(() => {
    let cancelled = false;
    let downloadedFile = null;

    const downloadPhoto = async () => {
      try {
        const authToken = token || await sessionManager.getToken();
        if (!authToken) throw new Error('Authentication is required to view this photo.');

        const directory = new Directory(Paths.cache, 'cloudcomai-moment-media');
        directory.create({ intermediates: true, idempotent: true });
        const extension = String(story.media_extension || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
        const target = new File(directory, `story-${Number(story.id)}-${Date.now()}.${extension}`);
        downloadedFile = await File.downloadFileAsync(
          buildApiUrl(API_BASE_URL, ApiRoute.STORY_MEDIA, { story_id: Number(story.id) }),
          target,
          { headers: { Authorization: `Bearer ${authToken}` } },
        );

        if (!downloadedFile?.exists || Number(downloadedFile.size || 0) <= 0) {
          throw new Error('The photo response was empty.');
        }
        if (cancelled) {
          downloadedFile.delete();
          return;
        }
        setLocalUri(downloadedFile.uri);
      } catch {
        if (!cancelled) setMediaError(true);
      }
    };

    void downloadPhoto();
    return () => {
      cancelled = true;
      if (downloadedFile?.exists) {
        try { downloadedFile.delete(); } catch {}
      }
    };
  }, [story.id, token]);

  if (mediaError) {
    return <View style={[styles.viewerMedia, styles.viewerMediaLoading]}><Text style={styles.viewerMediaMessage}>Unable to load this photo. Close it and try again.</Text></View>;
  }
  if (!localUri) {
    return <View style={[styles.viewerMedia, styles.viewerMediaLoading]}><ActivityIndicator color="#fff" /><Text style={styles.viewerMediaMessage}>Loading photo…</Text></View>;
  }
  return <View style={styles.photoZoomViewport} {...photoPanResponder.panHandlers}>
    <Animated.Image source={{ uri: localUri }} style={[styles.viewerMedia, { transform: [{ translateX: panX }, { translateY: panY }, { scale: zoomScale }] }]} resizeMode="contain" onError={() => setMediaError(true)} />
  </View>;
}

function MomentMedia({ story, token, paused, onFinish }) {
  const uri = buildApiUrl(API_BASE_URL, ApiRoute.STORY_MEDIA, { story_id: Number(story.id) });
  if (story.type === 'video') return <MomentVideo uri={uri} token={token} paused={paused} onFinish={onFinish} />;
  return <MomentPhoto story={story} token={token} />;
}

export default function MomentsScreen({ onBack, themeSettings, initialStoryId = null }) {
  const theme = resolveChatTheme(themeSettings);
  const [stories, setStories] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [hiddenIds, setHiddenIds] = useState([]);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [type, setType] = useState('text');
  const [text, setText] = useState('');
  const [asset, setAsset] = useState(null);
  const [audience, setAudience] = useState('contacts');
  const [groupIds, setGroupIds] = useState([]);
  const [hideExpanded, setHideExpanded] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedStory, setSelectedStory] = useState(null);
  const [viewers, setViewers] = useState([]);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [touchHolding, setTouchHolding] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const [viewerCount, setViewerCount] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [momentReply, setMomentReply] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyFocused, setReplyFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState('');
  const [emojiCategory, setEmojiCategory] = useState('Smileys & People');
  const [floatingEmoji, setFloatingEmoji] = useState('');
  const [floatingEmojiKey, setFloatingEmojiKey] = useState(0);
  const floatingEmojiY = React.useRef(new Animated.Value(0)).current;
  const floatingEmojiOpacity = React.useRef(new Animated.Value(0)).current;

  const registeredContacts = useMemo(() => (contacts || []).filter(contact => Number(contact.registered_user_id || contact.id) > 0), [contacts]);
  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return registeredContacts;
    return registeredContacts.filter(contact => `${contact.display_name || ''} ${contact.registered_name || ''} ${contact.registered_user_id_text || ''}`.toLowerCase().includes(query));
  }, [registeredContacts, contactSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [storyResponse, contactResponse, groupResponse, privacyResponse, authToken] = await Promise.all([
        platformApi.listStories(),
        platformApi.listContacts(1, 500),
        platformApi.listGroups(),
        platformApi.getStoryPrivacy(),
        sessionManager.getToken(),
      ]);
      setStories(storyResponse?.data?.stories || []);
      setContacts(contactResponse?.data?.contacts || []);
      setGroups(groupResponse?.data?.groups || []);
      setHiddenIds((privacyResponse?.data?.hidden_user_ids || []).map(Number));
      setToken(authToken || '');
    } catch (loadError) {
      setError(loadError?.message || 'Unable to load Moments right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!initialStoryId || !stories.length) return;
    const target = stories.find(item => Number(item.id) === Number(initialStoryId));
    if (target) {
      setSelectedStory(target);
      setStoryProgress(0);
      setIsPaused(false);
    }
  }, [initialStoryId, stories]);

  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const matchingEmojiCategories = useMemo(() => {
    const query = emojiSearch.trim();
    if (query) return MOMENT_EMOJI_CATEGORIES.map(category => ({ ...category, items: category.emojis.split(/\s+/).filter(emoji => emoji.includes(query) || (MOMENT_EMOJI_KEYWORDS[emoji] || '').includes(query.toLowerCase())) })).filter(category => category.items.length);
    const category = MOMENT_EMOJI_CATEGORIES.find(item => item.name === emojiCategory) || MOMENT_EMOJI_CATEGORIES[0];
    return [{ ...category, items: category.emojis.split(/\s+/).filter(Boolean) }];
  }, [emojiSearch, emojiCategory]);

  // Group all active Moments by author, matching WhatsApp's one-contact/one-row layout.
  const momentGroups = useMemo(() => {
    const grouped = new Map();
    (stories || []).forEach(story => {
      const key = String(story.user_id || (story.is_owner ? 'owner' : story.id));
      if (!grouped.has(key)) grouped.set(key, {
        key,
        userId: story.user_id,
        name: story.name || (story.is_owner ? 'You' : 'Contact'),
        isOwner: Boolean(story.is_owner),
        items: [],
      });
      grouped.get(key).items.push(story);
    });
    return Array.from(grouped.values()).map(group => {
      const items = [...group.items].sort((a, b) =>
        new Date(String(a.created_at).replace(' ', 'T') + 'Z').getTime()
        - new Date(String(b.created_at).replace(' ', 'T') + 'Z').getTime()
      );
      return {
        ...group,
        items,
        // Keep a contact in New until every currently active Moment from them is watched.
        watched: !group.isOwner && items.length > 0 && items.every(item => Boolean(item.watched)),
        latest: items[items.length - 1],
      };
    }).sort((a, b) => {
      const aTime = new Date(String(a.latest?.created_at || '').replace(' ', 'T') + 'Z').getTime() || 0;
      const bTime = new Date(String(b.latest?.created_at || '').replace(' ', 'T') + 'Z').getTime() || 0;
      return bTime - aTime;
    });
  }, [stories]);

  const ownMomentGroups = useMemo(() => momentGroups.filter(group => group.isOwner), [momentGroups]);
  const newMomentGroups = useMemo(() => momentGroups.filter(group => !group.isOwner && !group.watched), [momentGroups]);
  const watchedMomentGroups = useMemo(() => momentGroups.filter(group => !group.isOwner && group.watched), [momentGroups]);
  const selectedGroup = useMemo(
    () => momentGroups.find(group => group.items.some(item => Number(item.id) === Number(selectedStory?.id))),
    [momentGroups, selectedStory?.id],
  );
  const orderedMoments = useMemo(() => momentGroups.flatMap(group => group.items), [momentGroups]);
  const remainingMs = selectedStory?.expires_at
    ? Math.max(0, new Date(/Z$|[+-]\\d\\d:\\d\\d$/.test(String(selectedStory.expires_at)) ? selectedStory.expires_at : String(selectedStory.expires_at).replace(' ', 'T') + 'Z').getTime() - clockNow)
    : 0;
  const remainingHours = Math.floor(remainingMs / 3600000);
  const remainingMinutes = Math.floor((remainingMs % 3600000) / 60000);
  const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
  const remainingLabel = remainingMs <= 0 ? 'Expired' : remainingHours > 0
    ? `${remainingHours}h ${remainingMinutes}m left`
    : remainingMinutes > 0 ? `${remainingMinutes}m ${remainingSeconds}s left` : `${remainingSeconds}s left`;

  const openMomentGroup = group => {
    const firstUnwatched = group.items.find(item => !item.watched);
    setStoryProgress(0);
    setSelectedStory(firstUnwatched || group.items[0] || null);
  };

  const advanceMoment = useCallback(() => {
    if (!selectedStory) return;
    const index = orderedMoments.findIndex(item => Number(item.id) === Number(selectedStory.id));
    const next = orderedMoments[index + 1];
    if (next) {
      setStoryProgress(0);
      setSelectedStory(next);
      setIsPaused(false);
    } else {
      setSelectedStory(null);
      setIsPaused(false);
    }
  }, [orderedMoments, selectedStory]);

  const moveWithinMomentGroup = direction => {
    if (!selectedStory) return;
    const index = orderedMoments.findIndex(item => Number(item.id) === Number(selectedStory.id));
    const next = orderedMoments[index + direction];
    if (next) { setStoryProgress(0); setSelectedStory(next); setIsPaused(false); }
  };

  useEffect(() => {
    if (!selectedStory || isPaused || touchHolding || replyFocused || keyboardVisible || emojiPickerOpen || selectedStory.type === 'video') return undefined;
    const startingProgress = storyProgress;
    const remainingDuration = Math.max(0, 7000 * (1 - startingProgress / 100));
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const nextProgress = startingProgress + ((Date.now() - startedAt) / 7000) * 100;
      setStoryProgress(Math.min(100, nextProgress));
    }, 100);
    const timeout = setTimeout(advanceMoment, remainingDuration);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [selectedStory?.id, selectedStory?.type, isPaused, touchHolding, replyFocused, keyboardVisible, emojiPickerOpen, advanceMoment]);

  const formatRemaining = expiresAt => {
    if (!expiresAt) return 'Expiry unavailable';
    const expiry = new Date(/Z$|[+-]\\d\\d:\\d\\d$/.test(String(expiresAt)) ? expiresAt : String(expiresAt).replace(' ', 'T') + 'Z').getTime();
    const diff = Math.max(0, expiry - clockNow);
    if (!diff) return 'Expired';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return hours > 0 ? `${hours} hours ${minutes} min left` : `${minutes} min left`;
  };

  useEffect(() => {
    if (!selectedStory) { setViewerCount(0); return undefined; }
    setViewerCount(Number(selectedStory.view_count || 0));
  }, [selectedStory?.id]);

  useEffect(() => {
    if (!selectedStory || selectedStory.is_owner) return undefined;
    let active = true;
    platformApi.viewStory(selectedStory.id).then(response => {
      if (!active) return;
      const count = Number(response?.data?.count ?? selectedStory.view_count ?? 0);
      setViewerCount(count);
      setStories(current => current.map(item => Number(item.id) === Number(selectedStory.id)
        ? { ...item, watched: true, view_count: count }
        : item));
    }).catch(() => {});
    return () => { active = false; };
  }, [selectedStory?.id, selectedStory?.is_owner]);

  const playReaction = useCallback(emoji => {
    setFloatingEmoji(emoji);
    setFloatingEmojiKey(value => value + 1);
    floatingEmojiY.setValue(0);
    floatingEmojiOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(floatingEmojiY, { toValue: -190, duration: 2000, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(floatingEmojiOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(floatingEmojiOpacity, { toValue: 0, duration: 1750, useNativeDriver: true }),
      ]),
    ]).start();
  }, [floatingEmojiOpacity, floatingEmojiY]);

  const sendMomentReply = async (value = momentReply) => {
    const body = String(value || '').trim();
    if (!selectedStory || selectedStory.is_owner || !body || replySending) return;
    setReplySending(true);
    try {
      const response = await platformApi.replyToStory(Number(selectedStory.id), body);
      playReaction([...body].find(char => /\p{Extended_Pictographic}/u.test(char)) || '💬');
      setMomentReply('');
      if (response?.data?.chat_id) {
        // The reply is delivered through the existing private-chat message pipeline.
      }
    } catch (replyError) {
      setError(replyError?.message || 'Unable to send your Moment reply.');
    } finally {
      setReplySending(false);
    }
  };

  const openViewers = async story => {
    setIsPaused(true);
    setViewerLoading(true);
    setViewersOpen(true);
    try {
      const response = await platformApi.listStoryViewers(story.id);
      const rows = response?.data?.viewers || [];
      setViewers(rows);
      setViewerCount(Number(response?.data?.count ?? rows.length));
    } catch (viewerError) {
      setError(viewerError?.message || 'Unable to load viewers.');
      setViewers([]);
    } finally { setViewerLoading(false); }
  };

  const deleteMoment = story => Alert.alert('Delete Moment?', 'This Moment will be removed immediately for everyone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try {
        await platformApi.deleteStory(story.id);
        setSelectedStory(null);
        setStories(current => current.filter(item => Number(item.id) !== Number(story.id)));
      } catch (deleteError) { setError(deleteError?.message || 'Unable to delete this Moment.'); }
    } },
  ]);

  const toggleId = (items, setter, id) => {
    const value = Number(id);
    setter(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  };

  const pickMedia = async nextType => {
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: nextType === 'photo' ? ['images'] : ['videos'],
        allowsEditing: false,
        quality: 0.9,
        videoMaxDuration: VIDEO_MAX_SECONDS,
        ...(Platform.OS === 'ios' && ImagePicker.UIImagePickerPreferredAssetRepresentationMode
          ? { preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible }
          : {}),
      });
      if (result.canceled || !result.assets?.[0]) return;
      const picked = result.assets[0];
      if (nextType === 'photo' && Number(picked.fileSize || picked.size || 0) > PHOTO_MAX_BYTES) {
        throw new Error('Photos must be 12 MB or smaller.');
      }
      if (nextType === 'video') {
        const durationSeconds = Number(picked.duration || 0) / 1000;
        if (!durationSeconds || durationSeconds > VIDEO_MAX_SECONDS) throw new Error('Videos must be 90 seconds or shorter.');
      }
      setType(nextType);
      setAsset(picked);
      setText('');
    } catch (pickerError) {
      setError(pickerError?.message || 'Unable to select this media.');
    }
  };

  const savePrivacy = async () => {
    setBusy(true);
    setError('');
    try {
      await platformApi.updateStoryPrivacy(hiddenIds);
      Alert.alert('Privacy saved', 'Your Hide Status From list will remain active for future Moments.');
    } catch (saveError) {
      setError(saveError?.message || 'Unable to save Moments privacy.');
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (busy) return;
    if (type === 'text' && !text.trim()) { setError('Write a message before publishing.'); return; }
    if (type === 'text' && [...text].length > TEXT_MAX_LENGTH) { setError('Text Moments are limited to 500 characters.'); return; }
    if (type !== 'text' && !asset) { setError('Choose a photo or video first.'); return; }
    if (audience === 'groups' && groupIds.length === 0) { setError('Select at least one group.'); return; }
    setBusy(true);
    setError('');
    try {
      // Save exclusions first so the server applies the persistent privacy rule immediately.
      await platformApi.updateStoryPrivacy(hiddenIds);
      let content = text.trim();
      if (type !== 'text') {
        const durationSeconds = type === 'video' ? Math.ceil(Number(asset.duration || 0) / 1000) : undefined;
        if (type === 'video' && (!durationSeconds || durationSeconds > VIDEO_MAX_SECONDS)) throw new Error('Videos must be 90 seconds or shorter.');
        const upload = await uploadMobileFile(ApiRoute.STORY_MEDIA_UPLOAD, { ...asset, size: asset.fileSize || asset.size }, {
          fieldName: 'file',
          fallbackName: type === 'video' ? 'moment.mp4' : 'moment.jpg',
          fallbackMime: type === 'video' ? 'video/mp4' : 'image/jpeg',
          maxBytes: type === 'photo' ? PHOTO_MAX_BYTES : VIDEO_MAX_BYTES,
          multipartPartMode: 'expo-file',
          parameters: type === 'video' ? { duration_seconds: durationSeconds } : {},
        });
        content = { media_filename: upload?.data?.filename, caption: '' };
        if (!content.media_filename) throw new Error('The media upload did not return a valid file.');
      }
      await platformApi.createStory({ type, content, audience, group_ids: audience === 'groups' ? groupIds : [] });
      setComposeOpen(false);
      setText('');
      setAsset(null);
      setType('text');
      setGroupIds([]);
      await load();
      Alert.alert('Moment published', 'Your Moment will disappear automatically after 36 hours.');
    } catch (publishError) {
      setError(publishError?.message || 'Unable to publish this Moment.');
    } finally {
      setBusy(false);
    }
  };

  const resetCompose = () => {
    setError('');
    setComposeOpen(false);
  };

  const renderAudience = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Who can see this Moment?</Text>
      <Pressable style={styles.choiceRow} onPress={() => setAudience('contacts')}>
        <Text style={styles.choiceIcon}>{audience === 'contacts' ? '◉' : '○'}</Text>
        <View style={styles.choiceCopy}><Text style={styles.choiceTitle}>All Contacts</Text><Text style={styles.choiceHint}>People saved as CloudComAI contacts</Text></View>
      </Pressable>
      <Pressable style={styles.choiceRow} onPress={() => setAudience('groups')}>
        <Text style={styles.choiceIcon}>{audience === 'groups' ? '◉' : '○'}</Text>
        <View style={styles.choiceCopy}><Text style={styles.choiceTitle}>Selected Groups</Text><Text style={styles.choiceHint}>Only members of the groups you choose</Text></View>
      </Pressable>
      {audience === 'groups' ? (
        <View style={styles.nestedList}>
          {groups.length ? groups.map(group => <Pressable key={group.id} style={styles.checkRow} onPress={() => toggleId(groupIds, setGroupIds, group.id)}>
            <Text style={styles.checkMark}>{groupIds.includes(Number(group.id)) ? '☑' : '□'}</Text><Text style={styles.checkLabel}>{group.name || 'Group'}</Text>
          </Pressable>) : <Text style={styles.muted}>You are not currently a member of any groups.</Text>}
        </View>
      ) : null}
    </View>
  );

  const renderHiddenContacts = () => (
    <View style={styles.sectionCard}>
      <Pressable style={styles.dropdownHeader} onPress={() => setHideExpanded(value => !value)}>
        <View style={{ flex: 1 }}><Text style={styles.sectionTitle}>Hide Status From...</Text><Text style={styles.choiceHint}>{hiddenIds.length} contact{hiddenIds.length === 1 ? '' : 's'} hidden from your Moments</Text></View>
        <Text style={styles.chevron}>{hideExpanded ? '⌃' : '⌄'}</Text>
      </Pressable>
      {hideExpanded ? <>
        <TextInput value={contactSearch} onChangeText={setContactSearch} placeholder="Search contacts" placeholderTextColor="#8a94a6" style={styles.searchInput} />
        <View style={styles.nestedList}>
          {filteredContacts.map(contact => {
            const id = Number(contact.registered_user_id || contact.id);
            const selected = hiddenIds.includes(id);
            return <Pressable key={id} style={styles.checkRow} onPress={() => toggleId(hiddenIds, setHiddenIds, id)}>
              <Text style={styles.checkMark}>{selected ? '☑' : '□'}</Text>
              <View style={{ flex: 1 }}><Text style={styles.checkLabel}>{contact.display_name || contact.registered_name || 'Contact'}</Text><Text style={styles.muted}>@{contact.registered_user_id_text || id}</Text></View>
            </Pressable>;
          })}
          {!filteredContacts.length ? <Text style={styles.muted}>No registered contacts found.</Text> : null}
        </View>
        <Pressable style={styles.secondaryButton} disabled={busy} onPress={savePrivacy}><Text style={styles.secondaryButtonText}>{busy ? 'Saving…' : 'Save hidden contacts'}</Text></Pressable>
      </> : null}
    </View>
  );

  if (privacyOpen) {
    return <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]} edges={['top','bottom','left','right']}>
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <Pressable onPress={() => setPrivacyOpen(false)} accessibilityLabel="Go back"><Text style={[styles.back, { color: theme.colors.text }]}>‹ Back</Text></Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Moments Privacy</Text>
        <Pressable disabled={busy} onPress={savePrivacy}><Text style={[styles.publishText, busy && styles.disabled]}>{busy ? 'Saving…' : 'Save'}</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Hide Status From...</Text>
          <Text style={styles.choiceHint}>These contacts will not see any of your current or future Moments until you remove them from this list.</Text>
          <TextInput value={contactSearch} onChangeText={setContactSearch} placeholder="Search contacts" placeholderTextColor="#8a94a6" style={styles.searchInput} />
          <View style={styles.nestedList}>
            {filteredContacts.map(contact => {
              const id = Number(contact.registered_user_id || contact.id);
              const selected = hiddenIds.includes(id);
              return <Pressable key={id} style={styles.checkRow} onPress={() => toggleId(hiddenIds, setHiddenIds, id)}>
                <Text style={styles.checkMark}>{selected ? '☑' : '□'}</Text>
                <View style={{ flex: 1 }}><Text style={styles.checkLabel}>{contact.display_name || contact.registered_name || 'Contact'}</Text><Text style={styles.muted}>@{contact.registered_user_id_text || id}</Text></View>
              </Pressable>;
            })}
            {!filteredContacts.length ? <Text style={styles.muted}>No registered contacts found.</Text> : null}
          </View>
          <Text style={styles.muted}>{hiddenIds.length} contacts currently hidden. Clear a selection to allow that contact to see future Moments.</Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}><Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={savePrivacy}><Text style={styles.primaryButtonText}>{busy ? 'Saving…' : 'Save privacy settings'}</Text></Pressable></View>
    </SafeAreaView>;
  }

  if (composeOpen) {
    return <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]} edges={['top','bottom','left','right']}>
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <Pressable onPress={resetCompose} accessibilityLabel="Go back"><Text style={[styles.back, { color: theme.colors.text }]}>‹ Back</Text></Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Create Moment</Text>
        <Pressable disabled={busy} onPress={publish}><Text style={[styles.publishText, busy && styles.disabled]}>{busy ? 'Publishing…' : 'Publish'}</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.typeRow}>
          {['text','photo','video'].map(value => <Pressable key={value} onPress={() => { setType(value); if (value === 'text') setAsset(null); else void pickMedia(value); }} style={[styles.typeButton, type === value && styles.typeButtonActive]}><Text style={[styles.typeButtonText, type === value && styles.typeButtonTextActive]}>{value === 'text' ? 'Text' : value === 'photo' ? 'Photo' : 'Video'}</Text></Pressable>)}
        </View>
        {type === 'text' ? <View style={styles.sectionCard}><TextInput multiline value={text} onChangeText={setText} maxLength={TEXT_MAX_LENGTH} placeholder="Share a moment..." placeholderTextColor="#8a94a6" style={styles.textArea} /><Text style={styles.counter}>{[...text].length}/500</Text></View> : (
          <View style={styles.sectionCard}>
            <Pressable style={styles.secondaryButton} onPress={() => pickMedia(type)}><Text style={styles.secondaryButtonText}>{asset ? 'Choose a different ' + type : 'Choose ' + type}</Text></Pressable>
            {asset ? <Text style={styles.muted}>{asset.fileName || asset.uri?.split('/').pop() || 'Selected media'}{type === 'video' ? ' · ' + Math.ceil(Number(asset.duration || 0) / 1000) + ' sec' : ''}</Text> : <Text style={styles.muted}>Maximum photo size: 12 MB. Maximum video duration: 90 seconds.</Text>}
          </View>
        )}
        {renderAudience()}
        {renderHiddenContacts()}
        <Text style={styles.expiryNote}>Every Moment expires automatically 36 hours after publishing.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}><Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={publish}><Text style={styles.primaryButtonText}>{busy ? 'Publishing…' : 'Publish Moment'}</Text></Pressable></View>
    </SafeAreaView>;
  }

  return <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]} edges={['top','bottom','left','right']}>
    <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
      <Pressable onPress={onBack} accessibilityLabel="Go back to Home"><Text style={[styles.back, { color: theme.colors.text }]}>‹ Back</Text></Pressable>
      <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Moments</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => setPrivacyOpen(true)}><Text style={styles.publishText}>Privacy</Text></Pressable>
        <Pressable onPress={() => setComposeOpen(true)}><Text style={styles.publishText}>＋ Create</Text></Pressable>
      </View>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable style={styles.createCard} onPress={() => setComposeOpen(true)}>
        <View style={styles.createRing}><Text style={styles.createRingText}>＋</Text></View>
        <View style={{ flex: 1 }}><Text style={styles.createTitle}>Add to your Moments</Text><Text style={styles.muted}>Share a photo, video or text update</Text></View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      {loading ? <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.accent} /> : (
        <>
          {ownMomentGroups.length ? <>
            <Text style={styles.sectionTitle}>My Moments</Text>
            {ownMomentGroups.map(group => (
              <Pressable key={group.key} style={styles.storyRow} onPress={() => openMomentGroup(group)}>
                <View style={styles.storyRing}><MomentAuthorAvatar userId={group.userId} name={group.name} size={44} token={token} /></View>
                <View style={{ flex: 1 }}><Text style={styles.storyName}>Your Moment</Text><Text numberOfLines={1} style={styles.muted}>{group.items.length} active Moment{group.items.length === 1 ? '' : 's'} · latest {new Date(String(group.latest?.created_at).replace(' ', 'T') + 'Z').toLocaleString()}</Text></View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </> : null}
          <Text style={styles.sectionTitle}>New Moments</Text>
          {newMomentGroups.map(group => (
            <Pressable key={group.key} style={styles.storyRow} onPress={() => openMomentGroup(group)}>
              <View style={styles.storyRing}><MomentAuthorAvatar userId={group.userId} name={group.name} size={44} token={token} /></View>
              <View style={{ flex: 1 }}><Text style={styles.storyName}>{group.name}</Text><Text numberOfLines={1} style={styles.muted}>{group.items.length} new Moment{group.items.length === 1 ? '' : 's'} · latest {new Date(String(group.latest?.created_at).replace(' ', 'T') + 'Z').toLocaleString()}</Text></View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
          {!newMomentGroups.length && !ownMomentGroups.length ? <Text style={styles.empty}>No new Moments right now.</Text> : null}
          <Text style={styles.sectionTitle}>Viewed Moments</Text>
          {watchedMomentGroups.map(group => (
            <Pressable key={group.key} style={styles.storyRow} onPress={() => openMomentGroup(group)}>
              <View style={[styles.storyRing, styles.storyRingWatched]}><MomentAuthorAvatar userId={group.userId} name={group.name} size={44} /></View>
              <View style={{ flex: 1 }}><Text style={styles.storyName}>{group.name}</Text><Text numberOfLines={1} style={styles.muted}>{group.items.length} Moment{group.items.length === 1 ? '' : 's'} · viewed</Text></View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
          {!watchedMomentGroups.length ? <Text style={styles.muted}>Viewed contacts will appear here.</Text> : null}
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.expiryNote}>Moments disappear 36 hours after publishing.</Text>
    </ScrollView>
    <Modal visible={Boolean(selectedStory)} transparent={false} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => { setSelectedStory(null); setIsPaused(false); }}>
      <View style={styles.fullscreenViewer}>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${storyProgress}%` }]} /></View>
        <View style={styles.fullscreenTop}>
          <View style={styles.authorHeader}>
            {selectedStory ? <MomentAuthorAvatar userId={selectedStory.user_id} name={selectedStory.name} size={38} token={token} /> : null}
            <View style={{ flex: 1 }}><Text style={styles.fullscreenName}>{selectedStory?.name || (selectedStory?.is_owner ? 'You' : 'Moment')}</Text><Text style={styles.fullscreenMeta}>{selectedStory?.is_owner ? 'Your Moment' : 'Moment'} · {remainingLabel}</Text></View>
          </View>
          <View style={styles.topActions}>
            {selectedStory?.is_owner ? <Pressable onPress={() => openViewers(selectedStory)}><Text style={styles.fullscreenAction}>◉ {viewerCount ?? Number(selectedStory.view_count || 0)}</Text></Pressable> : null}
            <Pressable onPress={() => setIsPaused(value => !value)}><Text style={styles.fullscreenAction}>{isPaused ? '▶' : 'Ⅱ'}</Text></Pressable>
            <Pressable onPress={() => { setSelectedStory(null); setIsPaused(false); }}><Text style={styles.fullscreenClose}>×</Text></Pressable>
          </View>
        </View>
        <View style={styles.fullscreenContent} onTouchStart={() => setTouchHolding(true)} onTouchEnd={event => { if (!(event.nativeEvent.touches || []).length) setTouchHolding(false); }} onTouchCancel={() => setTouchHolding(false)}>
          {selectedStory?.type === 'text'
            ? <Text style={styles.fullscreenText}>{selectedStory?.content}</Text>
            : selectedStory ? <MomentMedia story={selectedStory} token={token} paused={isPaused || touchHolding || replyFocused || keyboardVisible || emojiPickerOpen} onFinish={() => { if (!isPaused && !touchHolding && !replyFocused && !keyboardVisible && !emojiPickerOpen) advanceMoment(); }} /> : null}
          {selectedStory?.caption ? <Text style={styles.fullscreenCaption}>{selectedStory.caption}</Text> : null}
        </View>
        {selectedStory && !selectedStory.is_owner ? <View style={styles.momentReplyPanel}>
          <View style={styles.momentQuickReactions}>
            {['❤️', '😂', '😮', '👍'].map(emoji => <Pressable key={emoji} disabled={replySending} onPress={() => sendMomentReply(emoji)} style={styles.momentQuickReaction}><Text style={styles.momentQuickEmoji}>{emoji}</Text></Pressable>)}
          </View>
          <View style={styles.momentReplyRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Open emoji picker" onPress={() => { Keyboard.dismiss(); setReplyFocused(false); setEmojiSearch(''); setEmojiPickerOpen(true); }} style={styles.momentEmojiPickerButton}><Text style={styles.momentEmojiPickerIcon}>☺</Text></Pressable>
            <TextInput value={momentReply} onChangeText={setMomentReply} placeholder="Send a reply..." placeholderTextColor="#94a3b8" multiline maxLength={1000} style={styles.momentReplyInput} returnKeyType="send" onFocus={() => setReplyFocused(true)} onBlur={() => setReplyFocused(false)} onSubmitEditing={() => { void sendMomentReply(); Keyboard.dismiss(); }} />
            <Pressable disabled={!momentReply.trim() || replySending} onPress={() => { void sendMomentReply(); Keyboard.dismiss(); }} style={[styles.momentSendButton, (!momentReply.trim() || replySending) && { opacity: 0.5 }]}><Text style={styles.momentSendText}>{replySending ? '…' : 'Send'}</Text></Pressable>
          </View>
        </View> : null}
        {emojiPickerOpen ? <View style={styles.emojiPickerBackdrop}>
          <View style={styles.emojiPickerPanel}>
            <View style={styles.emojiPickerHeader}><Text style={styles.emojiPickerTitle}>Choose an emoji</Text><Pressable accessibilityRole="button" accessibilityLabel="Close emoji picker" onPress={() => setEmojiPickerOpen(false)}><Text style={styles.emojiPickerClose}>×</Text></Pressable></View>
            <TextInput value={emojiSearch} onChangeText={setEmojiSearch} placeholder="Search emojis..." placeholderTextColor="#94a3b8" style={styles.emojiSearchInput} autoCorrect={false} />
            {!emojiSearch.trim() ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiCategoryTabs} contentContainerStyle={styles.emojiCategoryTabsContent}>{MOMENT_EMOJI_CATEGORIES.map(category => <Pressable key={category.name} onPress={() => setEmojiCategory(category.name)} style={[styles.emojiCategoryTab, emojiCategory === category.name && styles.emojiCategoryTabActive]}><Text style={styles.emojiCategoryIcon}>{category.icon}</Text></Pressable>)}</ScrollView> : null}
            <ScrollView style={styles.emojiGridScroll} contentContainerStyle={styles.emojiGrid} keyboardShouldPersistTaps="always">
              {matchingEmojiCategories.map(category => <React.Fragment key={category.name}>{emojiSearch.trim() ? <Text style={styles.emojiCategoryHeading}>{category.name}</Text> : null}{category.items.map((emoji, index) => <Pressable key={`${category.name}-${index}-${emoji}`} accessibilityRole="button" accessibilityLabel={`React with ${emoji}`} onPress={() => { setEmojiPickerOpen(false); setEmojiSearch(''); void sendMomentReply(emoji); }} style={styles.emojiCell}><Text style={styles.emojiCellText}>{emoji}</Text></Pressable>)}</React.Fragment>)}
              {!matchingEmojiCategories.length ? <Text style={styles.emojiEmpty}>No matching emojis</Text> : null}
            </ScrollView>
          </View>
        </View> : null}
        {floatingEmoji ? <Animated.View key={floatingEmojiKey} pointerEvents="none" style={[styles.floatingReaction, { opacity: floatingEmojiOpacity, transform: [{ translateY: floatingEmojiY }] }]}><Text style={styles.floatingReactionEmoji}>{floatingEmoji}</Text></Animated.View> : null}
        <View style={styles.fullscreenBottom}>
          <Text style={styles.fullscreenMeta}>{selectedStory ? `Moment ${orderedMoments.findIndex(item => Number(item.id) === Number(selectedStory.id)) + 1} of ${orderedMoments.length}` : ''}</Text>
          <View style={styles.sequenceButtons}>
            <Pressable onPress={() => moveWithinMomentGroup(-1)} style={styles.fullscreenActionButton}><Text style={styles.fullscreenAction}>‹ Previous</Text></Pressable>
            <Pressable onPress={advanceMoment} style={styles.fullscreenActionButton}><Text style={styles.fullscreenAction}>Next ›</Text></Pressable>
          </View>
          {selectedStory?.is_owner ? <Pressable onPress={() => deleteMoment(selectedStory)} style={styles.fullscreenDelete}><Text style={styles.fullscreenAction}>Delete Moment</Text></Pressable> : null}
          {selectedStory?.is_owner ? <Text style={styles.fullscreenMeta}>Seen by {viewerCount || selectedStory.view_count || 0}</Text> : null}
        </View>
      </View>
    </Modal>
    <Modal visible={viewersOpen} transparent animationType="slide" onRequestClose={() => { setViewersOpen(false); setIsPaused(false); }}>
      <View style={styles.viewerBackdrop}><View style={styles.viewerListCard}>
        <View style={styles.viewerHeader}><Text style={styles.viewerTitle}>Seen By ({viewers.length})</Text><Pressable onPress={() => { setViewersOpen(false); setIsPaused(false); }}><Text style={styles.close}>×</Text></Pressable></View>
        {viewerLoading ? <ActivityIndicator color={theme.colors.accent} /> : <ScrollView style={styles.viewerList}>
          {viewers.map(viewer => <View key={viewer.viewer_id} style={styles.viewerRow}>
            <MomentAuthorAvatar userId={viewer.viewer_id} name={viewer.name || viewer.username} size={42} token={token} />
            <View style={{ flex: 1 }}><Text style={styles.viewerName}>{viewer.name || viewer.username || 'CloudComAI user'}</Text><Text style={styles.muted}>@{viewer.username || viewer.viewer_id}</Text></View>
          </View>)}
          {!viewers.length && !viewerLoading ? <Text style={styles.empty}>No views yet.</Text> : null}
        </ScrollView>}
      </View></View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderBottomWidth: 1 },
  back: { width: 64, fontSize: 16, fontWeight: '700' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  publishText: { minWidth: 64, textAlign: 'right', color: '#3157d5', fontWeight: '800', fontSize: 14 },
  content: { padding: 16, paddingBottom: 28, gap: 12 },
  createCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: '#dbe4ff', borderRadius: 16, backgroundColor: '#f8faff' },
  createRing: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#3157d5', alignItems: 'center', justifyContent: 'center' },
  createRingText: { color: '#3157d5', fontSize: 26, fontWeight: '700' },
  createTitle: { color: '#172033', fontWeight: '800', fontSize: 15 },
  sectionTitle: { color: '#172033', fontWeight: '800', fontSize: 15 },
  sectionCard: { padding: 14, borderWidth: 1, borderColor: '#e3e8f2', borderRadius: 14, backgroundColor: '#fff', gap: 10 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d8deea', borderRadius: 10, backgroundColor: '#fff' },
  typeButtonActive: { borderColor: '#3157d5', backgroundColor: '#eef2ff' },
  typeButtonText: { color: '#596579', fontWeight: '700' },
  typeButtonTextActive: { color: '#3157d5' },
  textArea: { minHeight: 140, color: '#172033', fontSize: 16, textAlignVertical: 'top' },
  counter: { color: '#68748a', textAlign: 'right', fontSize: 12 },
  choiceRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10 },
  choiceIcon: { color: '#3157d5', fontSize: 22, width: 28 },
  choiceCopy: { flex: 1 },
  choiceTitle: { color: '#172033', fontWeight: '700', fontSize: 14 },
  choiceHint: { color: '#68748a', fontSize: 12, marginTop: 2 },
  nestedList: { paddingLeft: 8, borderTopWidth: 1, borderTopColor: '#edf0f5' },
  checkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#f0f2f6' },
  checkMark: { color: '#3157d5', fontSize: 20 },
  checkLabel: { color: '#172033', fontSize: 14, fontWeight: '600' },
  muted: { color: '#68748a', fontSize: 12, marginTop: 2 },
  dropdownHeader: { minHeight: 50, flexDirection: 'row', alignItems: 'center' },
  chevron: { color: '#3157d5', fontSize: 24, fontWeight: '700' },
  searchInput: { minHeight: 42, borderWidth: 1, borderColor: '#d8deea', borderRadius: 10, paddingHorizontal: 12, color: '#172033', marginVertical: 8 },
  secondaryButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3157d5', borderRadius: 10, paddingHorizontal: 12 },
  secondaryButtonText: { color: '#3157d5', fontWeight: '700' },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#3157d5' },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  footer: { paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#edf0f5', backgroundColor: '#fff' },
  expiryNote: { color: '#68748a', fontSize: 12, textAlign: 'center', paddingVertical: 6 },
  error: { color: '#b91c1c', fontSize: 13, padding: 8, backgroundColor: '#fee2e2', borderRadius: 8 },
  disabled: { opacity: 0.55 },
  storyRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: 1, borderColor: '#edf0f5', borderRadius: 14, backgroundColor: '#fff' },
  storyRing: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#3157d5', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8faff' },
  authorAvatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#e0e7ff' },
  authorAvatarInitial: { color: '#3157d5', fontWeight: '800', textAlign: 'center' },
  authorHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  storyRingWatched: { borderColor: '#cbd5e1' },
  momentSequence: { gap: 8, paddingTop: 4 },
  sequenceButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  sequenceButton: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#dbe4ff', borderRadius: 10 },
  sequenceButtonText: { color: '#3157d5', fontWeight: '800' },
  storyRingText: { color: '#3157d5', fontWeight: '800', fontSize: 18 },
  storyName: { color: '#172033', fontSize: 14, fontWeight: '800' },
  empty: { color: '#68748a', textAlign: 'center', padding: 24, backgroundColor: '#f8faff', borderRadius: 12 },
  fullscreenViewer: { flex: 1, backgroundColor: '#050505', paddingTop: Platform.OS === 'ios' ? 54 : 34, paddingBottom: Platform.OS === 'ios' ? 28 : 16 },
  progressTrack: { height: 3, marginHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: '#fff' },
  fullscreenTop: { minHeight: 62, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fullscreenName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  fullscreenMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  fullscreenAction: { color: '#fff', fontWeight: '700', fontSize: 14 },
  fullscreenClose: { color: '#fff', fontSize: 30, lineHeight: 34 },
  fullscreenContent: { flex: 1, alignItems: 'stretch', justifyContent: 'center', backgroundColor: '#000' },
  photoZoomViewport: { width: '100%', height: '100%', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fullscreenText: { color: '#fff', fontSize: 28, lineHeight: 38, fontWeight: '700', textAlign: 'center', paddingHorizontal: 28 },
  fullscreenCaption: { position: 'absolute', bottom: 16, left: 18, right: 18, color: '#fff', fontSize: 15, textShadowColor: '#000', textShadowRadius: 8 },
  momentReplyPanel: { paddingHorizontal: 14, paddingTop: 8, gap: 8, backgroundColor: 'rgba(0,0,0,0.82)' },
  momentQuickReactions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  momentQuickReaction: { width: 38, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.14)' },
  momentQuickEmoji: { fontSize: 21 },
  momentReplyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 42 },
  momentEmojiPickerButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  momentEmojiPickerIcon: { color: '#fff', fontSize: 25, fontWeight: '700' },
  emojiPickerBackdrop: { ...StyleSheet.absoluteFillObject, zIndex: 40, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  emojiPickerPanel: { height: '58%', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#171923' },
  emojiPickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  emojiPickerTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  emojiPickerClose: { color: '#fff', fontSize: 28, lineHeight: 30, paddingHorizontal: 8 },
  emojiSearchInput: { minHeight: 40, borderRadius: 10, paddingHorizontal: 12, color: '#fff', backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 8 },
  emojiCategoryTabs: { maxHeight: 42, flexGrow: 0, marginBottom: 8 },
  emojiCategoryTabsContent: { gap: 8, alignItems: 'center' },
  emojiCategoryTab: { width: 38, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.08)' },
  emojiCategoryTabActive: { backgroundColor: '#3157d5' },
  emojiCategoryIcon: { color: '#fff', fontSize: 20 },
  emojiGridScroll: { flex: 1 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', paddingBottom: 12 },
  emojiCategoryHeading: { width: '100%', color: '#cbd5e1', fontSize: 12, fontWeight: '700', paddingVertical: 8 },
  emojiCell: { width: '12.5%', minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  emojiCellText: { fontSize: 25 },
  emojiEmpty: { color: '#cbd5e1', textAlign: 'center', padding: 20 },
  momentReplyInput: { flex: 1, minHeight: 40, maxHeight: 86, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22, color: '#fff', backgroundColor: 'rgba(255,255,255,0.14)' },
  momentSendButton: { minWidth: 54, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3157d5' },
  momentSendText: { color: '#fff', fontWeight: '800' },
  floatingReaction: { position: 'absolute', zIndex: 20, bottom: 180, alignSelf: 'center', left: '44%' },
  floatingReactionEmoji: { fontSize: 54, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 12 },
  fullscreenBottom: { paddingHorizontal: 16, paddingTop: 10, gap: 10 },
  fullscreenActionButton: { flex: 1, minHeight: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' },
  fullscreenDelete: { alignSelf: 'flex-start', paddingVertical: 8 },
  viewerBackdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(15,23,42,0.75)' },
  ownerActions: { flexDirection: 'row', gap: 8 },
  deleteButton: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: '#ef4444', borderRadius: 10 },
  deleteButtonText: { color: '#dc2626', fontWeight: '800' },
  viewerListCard: { maxHeight: '70%', padding: 16, borderRadius: 18, backgroundColor: '#fff', gap: 12 },
  viewerList: { flexGrow: 0 },
  viewerRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#edf0f5' },
  viewerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#e2e8f0' },
  viewerName: { color: '#172033', fontSize: 14, fontWeight: '700' },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewerTitle: { color: '#172033', fontSize: 16, fontWeight: '800' },
  close: { color: '#172033', fontSize: 28 },
  viewerMedia: { width: '100%', height: '100%', backgroundColor: '#000' },
  viewerMediaLoading: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18 },
  viewerMediaMessage: { color: '#fff', fontSize: 13, textAlign: 'center' },
  viewerText: { color: '#172033', fontSize: 22, lineHeight: 30, paddingVertical: 28, textAlign: 'center' },
  viewerCaption: { color: '#172033', fontSize: 14 },
});
