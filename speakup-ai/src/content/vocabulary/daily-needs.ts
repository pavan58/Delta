/**
 * Daily Needs vocabulary — everyday picture words with Hindi meanings.
 * Entry format: "word|हिंदी|emoji|flag|custom example"
 *   flag: "" countable singular, "p" plural noun, "u" uncountable, "a" adjective, "v" action phrase
 */

export interface DailyCategory {
  id: string;
  label: string;
  emoji: string;
  example: (w: string, e: { flag: string }) => string;
}

export interface DailyWord {
  id: string;
  word: string;
  hi: string;
  emoji: string;
  category: string;
  flag: string;
  example: string;
}

const an = (w: string) => (/^(hour|honest)/i.test(w) ? "an" : /^(uni|use|euro|one)/i.test(w) ? "a" : /^[aeiou]/i.test(w) ? "an" : "a");
const np = (w: string, f: string) => (f === "p" || f === "u" ? `some ${w}` : `${an(w)} ${w}`);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export const DAILY_CATEGORIES: DailyCategory[] = [
  { id: "animals", label: "Animals", emoji: "🐘", example: (w) => `I saw ${an(w)} ${w} at the zoo.` },
  { id: "birds", label: "Birds", emoji: "🦜", example: (w) => `I can see ${an(w)} ${w} on the tree.` },
  { id: "insects", label: "Insects & small creatures", emoji: "🐝", example: (w) => `There is ${an(w)} ${w} on the wall.` },
  { id: "fruits", label: "Fruits", emoji: "🍎", example: (w, e) => `I bought ${np(w, e.flag)} from the market.` },
  { id: "vegetables", label: "Vegetables", emoji: "🥕", example: (w, e) => `We need ${np(w, e.flag)} for dinner.` },
  { id: "plants", label: "Plants & trees", emoji: "🌳", example: (w, e) => (e.flag === "u" ? `There is ${w} in our garden.` : `There is ${an(w)} ${w} in our garden.`) },
  { id: "flowers", label: "Flowers", emoji: "🌸", example: (w) => `She gave me ${an(w)} ${w}.` },
  { id: "body", label: "Body parts", emoji: "🖐️", example: (w, e) => (e.flag === "p" ? `These are my ${w}.` : e.flag === "u" ? `My ${w} is black.` : `This is my ${w}.`) },
  { id: "family", label: "Family & people", emoji: "👨‍👩‍👧", example: (w, e) => (e.flag === "p" ? `These are my ${w}.` : `This is my ${w}.`) },
  { id: "home", label: "Home & furniture", emoji: "🛋️", example: (w, e) => (e.flag === "p" ? `There are ${w} in our house.` : e.flag === "u" ? `There is a lot of ${w} in our house.` : `There is ${an(w)} ${w} in our house.`) },
  { id: "kitchen", label: "Kitchen items", emoji: "🍳", example: (w) => `Please pass me the ${w}.` },
  { id: "clothes", label: "Clothes & accessories", emoji: "👕", example: (w, e) => (e.flag === "p" ? `I am wearing ${w} today.` : `I am wearing ${an(w)} ${w} today.`) },
  { id: "colours", label: "Colours & shapes", emoji: "🎨", example: (w, e) => (e.flag === "a" ? `My bag is ${w}.` : `Draw ${an(w)} ${w} on the paper.`) },
  { id: "food", label: "Food & drinks", emoji: "🍛", example: (w, e) => `I would like ${np(w, e.flag)}, please.` },
  { id: "nature", label: "Weather & nature", emoji: "🌦️", example: (w) => `Look at the ${w}!` },
  { id: "transport", label: "Transport", emoji: "🚌", example: (w) => `Have you ever travelled by ${w}?` },
  { id: "places", label: "Places in town", emoji: "🏥", example: (w) => `Where is the nearest ${w}?` },
  { id: "jobs", label: "Jobs", emoji: "👩‍⚕️", example: (w) => `My neighbour is ${an(w)} ${w}.` },
  { id: "emotions", label: "Feelings", emoji: "😊", example: (w) => `I feel ${w} today.` },
  { id: "actions", label: "Daily actions", emoji: "🪥", example: (w) => `Every day I ${w}.` },
  { id: "time", label: "Time & calendar", emoji: "📅", example: (w) => `${cap(w)} is my favourite time.` },
  { id: "school", label: "School & office", emoji: "✏️", example: (w, e) => (e.flag === "p" ? `Can I borrow your ${w}?` : `Can I borrow your ${w}?`) },
  { id: "sports", label: "Sports & games", emoji: "🏏", example: (w) => (/ing$/.test(w) ? `I like ${w}.` : `I like playing ${w}.`) },
];

const RAW: Record<string, string> = {
  animals: `dog|कुत्ता|🐕
cat|बिल्ली|🐈
cow|गाय|🐄
buffalo|भैंस|🐃
goat|बकरी|🐐
sheep|भेड़|🐑
horse|घोड़ा|🐎
donkey|गधा|🫏
camel|ऊँट|🐫
elephant|हाथी|🐘
lion|शेर|🦁
tiger|बाघ|🐅
leopard|तेंदुआ|🐆
bear|भालू|🐻
monkey|बंदर|🐒
deer|हिरण|🦌
fox|लोमड़ी|🦊
wolf|भेड़िया|🐺
rabbit|खरगोश|🐇
squirrel|गिलहरी|🐿️
rat|चूहा|🐀
pig|सूअर|🐖
giraffe|जिराफ़|🦒
zebra|ज़ेबरा|🦓
rhinoceros|गैंडा|🦏
crocodile|मगरमच्छ|🐊
snake|साँप|🐍
frog|मेंढक|🐸
tortoise|कछुआ|🐢
fish|मछली|🐟
whale|व्हेल मछली|🐋
dolphin|डॉल्फ़िन|🐬
kangaroo|कंगारू|🦘
bat|चमगादड़|🦇
lizard|छिपकली|🦎`,
  birds: `crow|कौआ|🐦‍⬛
sparrow|गौरैया|🐦
pigeon|कबूतर|🕊️
parrot|तोता|🦜
peacock|मोर|🦚
eagle|गरुड़ / चील|🦅
owl|उल्लू|🦉
duck|बत्तख|🦆
hen|मुर्गी|🐔
rooster|मुर्गा|🐓
swan|हंस|🦢
penguin|पेंगुइन|🐧
ostrich|शुतुरमुर्ग|🪶
flamingo|राजहंस|🦩
woodpecker|कठफोड़वा|🐦
kingfisher|किलकिला|🐦
cuckoo|कोयल|🐦
vulture|गिद्ध|🦅
crane|सारस|🐦
nest|घोंसला|🪺`,
  insects: `ant|चींटी|🐜
bee|मधुमक्खी|🐝
butterfly|तितली|🦋
mosquito|मच्छर|🦟
fly|मक्खी|🪰
cockroach|तिलचट्टा|🪳
spider|मकड़ी|🕷️
beetle|भृंग|🪲
ladybird|सोनपंखी कीड़ा|🐞
grasshopper|टिड्डा|🦗
caterpillar|इल्ली|🐛
worm|कीड़ा / केंचुआ|🪱
snail|घोंघा|🐌
scorpion|बिच्छू|🦂
dragonfly|व्याध पतंग|🪰
firefly|जुगनू|✨
termite|दीमक|🐜
moth|पतंगा|🦋`,
  fruits: `apple|सेब|🍎
banana|केला|🍌
mango|आम|🥭
orange|संतरा|🍊
grapes|अंगूर|🍇|p
pineapple|अनानास|🍍
watermelon|तरबूज़|🍉
muskmelon|ख़रबूज़ा|🍈
papaya|पपीता|🥭
guava|अमरूद|🍐
pomegranate|अनार|🍎
strawberry|स्ट्रॉबेरी|🍓
cherry|चेरी|🍒
peach|आड़ू|🍑
pear|नाशपाती|🍐
plum|आलूबुखारा|🍑
coconut|नारियल|🥥
lemon|नींबू|🍋
kiwi|कीवी|🥝
jackfruit|कटहल|🍈
custard apple|सीताफल|🍏
fig|अंजीर|🫐
dates|खजूर|🌴|p
berries|जामुन / बेरी|🫐|p
lychee|लीची|🍒
sweet lime|मौसंबी|🍋
apricot|ख़ुबानी|🍑
avocado|एवोकाडो|🥑`,
  vegetables: `potato|आलू|🥔
onion|प्याज़|🧅
tomato|टमाटर|🍅
carrot|गाजर|🥕
cabbage|पत्तागोभी|🥬
cauliflower|फूलगोभी|🥦
brinjal|बैंगन|🍆
okra|भिंडी|🫛|u
spinach|पालक|🥬|u
peas|मटर|🫛|p
cucumber|खीरा|🥒
pumpkin|कद्दू|🎃
radish|मूली|🥕
beetroot|चुकंदर|🫜
garlic|लहसुन|🧄|u
ginger|अदरक|🫚|u
green chilli|हरी मिर्च|🌶️
capsicum|शिमला मिर्च|🫑
bitter gourd|करेला|🥒
bottle gourd|लौकी|🥒
corn|मक्का|🌽|u
mushroom|कुकुरमुत्ता / मशरूम|🍄
coriander|धनिया|🌿|u
mint|पुदीना|🌿|u
sweet potato|शकरकंद|🍠
beans|सेम / बीन्स|🫛|p
lettuce|सलाद पत्ता|🥬
broccoli|ब्रोकली|🥦|u`,
  plants: `tree|पेड़|🌳
plant|पौधा|🪴
leaf|पत्ता|🍃
branch|डाली|🌿
root|जड़|🌱
seed|बीज|🌰
grass|घास|🌾|u
bush|झाड़ी|🌳
cactus|नागफनी|🌵
bamboo|बाँस|🎋|u
palm tree|ताड़ का पेड़|🌴
banyan tree|बरगद का पेड़|🌳
neem tree|नीम का पेड़|🌳
peepal tree|पीपल का पेड़|🌳
pine tree|चीड़ का पेड़|🌲
coconut tree|नारियल का पेड़|🌴
tulsi plant|तुलसी का पौधा|🌿
aloe vera plant|घृतकुमारी का पौधा|🪴
creeper|बेल / लता|🌿
thorn|काँटा|🌵
bark|छाल|🪵|u
trunk|तना|🪵
flower pot|गमला|🪴
moss|काई|🌿|u
wheat plant|गेहूँ का पौधा|🌾
rice plant|धान का पौधा|🌾`,
  flowers: `rose|गुलाब|🌹
lotus|कमल|🪷
sunflower|सूरजमुखी|🌻
jasmine|चमेली / मोगरा|🌼
marigold|गेंदा|🌼
lily|कुमुदिनी / लिली|🌷
tulip|ट्यूलिप|🌷
hibiscus|गुड़हल|🌺
daisy|गुलबहार|🌼
orchid|ऑर्किड|🌸
bud|कली|🌱
petal|पंखुड़ी|🌸
bouquet|गुलदस्ता|💐
garland|माला|💮
cherry blossom|चेरी का फूल|🌸
dandelion|सिंहपर्णी|🌼`,
  body: `head|सिर|🙂
hair|बाल|💇|u
face|चेहरा|😀
forehead|माथा|🙂
eye|आँख|👁️
eyebrow|भौंह|🤨
nose|नाक|👃
ear|कान|👂
mouth|मुँह|👄
lips|होंठ|👄|p
teeth|दाँत|🦷|p
tongue|जीभ|👅
cheek|गाल|☺️
chin|ठुड्डी|🙂
neck|गर्दन|🧣
shoulder|कंधा|💪
arm|बाँह|💪
elbow|कोहनी|💪
hand|हाथ|✋
finger|उँगली|☝️
thumb|अँगूठा|👍
nail|नाख़ून|💅
chest|छाती|🫁
stomach|पेट|🫃
back|पीठ|🧍
waist|कमर|🧍
leg|पैर / टाँग|🦵
knee|घुटना|🦵
foot|पैर / पाँव|🦶
toe|पैर की उँगली|🦶
heart|दिल|❤️
brain|दिमाग़|🧠
skin|त्वचा|✋|u|Use sunscreen to protect your skin.
blood|ख़ून|🩸|u|He donated blood at the hospital.`,
  family: `mother|माँ|👩
father|पिता|👨
parents|माता-पिता|👪|p
brother|भाई|👦
sister|बहन|👧
son|बेटा|👦
daughter|बेटी|👧
husband|पति|🤵
wife|पत्नी|👰
grandfather|दादा / नाना|👴
grandmother|दादी / नानी|👵
uncle|चाचा / मामा|👨
aunt|चाची / मौसी|👩
cousin|चचेरा / ममेरा भाई-बहन|🧑
nephew|भतीजा / भांजा|👦
niece|भतीजी / भांजी|👧
baby|बच्चा (शिशु)|👶
child|बच्चा|🧒
neighbour|पड़ोसी|🏘️
friend|दोस्त|🤝
guest|मेहमान|🙋
father-in-law|ससुर|👨
mother-in-law|सास|👩
twins|जुड़वाँ|👯|p|My cousins are twins.`,
  home: `house|घर|🏠
room|कमरा|🚪
door|दरवाज़ा|🚪
window|खिड़की|🪟
wall|दीवार|🧱||There is a clock on the wall.
floor|फ़र्श|🟫||The floor is wet. Be careful!
roof|छत|🏠||We sleep on the roof in summer.
stairs|सीढ़ियाँ|🪜|p
bed|पलंग / बिस्तर|🛏️
pillow|तकिया|🛏️
blanket|कंबल|🛏️
bedsheet|चादर|🛏️
chair|कुर्सी|🪑
table|मेज़|🪑
sofa|सोफ़ा|🛋️
cupboard|अलमारी|🗄️
mirror|आईना|🪞
fan|पंखा|🌀
light bulb|बल्ब|💡
television|टेलीविज़न|📺
clock|घड़ी (दीवार)|🕰️
curtain|पर्दा|🪟
carpet|क़ालीन|🟥
bucket|बाल्टी|🪣
broom|झाड़ू|🧹
soap|साबुन|🧼
towel|तौलिया|🧺
toothbrush|टूथब्रश|🪥
comb|कंघी|🪮
key|चाबी|🔑
lock|ताला|🔒
switch|बटन / स्विच|🔘
furniture|फ़र्नीचर|🛋️|u
dustbin|कूड़ेदान|🗑️`,
  kitchen: `plate|थाली / प्लेट|🍽️
bowl|कटोरी|🥣
glass|गिलास|🥛
cup|कप|☕
spoon|चम्मच|🥄
fork|काँटा (खाने का)|🍴
knife|चाकू|🔪
pan|कड़ाही / तवा|🍳
pressure cooker|प्रेशर कुकर|🍲
pot|बर्तन / पतीला|🍲
gas stove|गैस चूल्हा|🔥||Turn off the gas stove after cooking.
refrigerator|फ़्रिज|🧊||Keep the milk in the refrigerator.
rolling pin|बेलन|🥖
sieve|छलनी|🥣
grater|कद्दूकस|🧀
mixer|मिक्सर|🥤
jar|डिब्बा / मर्तबान|🫙
bottle|बोतल|🍾
tray|ट्रे|🍽️
tongs|चिमटा|🥢
ladle|करछी|🥄
chopping board|काटने का तख़्ता|🔪
kettle|केतली|🫖
matchbox|माचिस|🔥
salt|नमक|🧂
sugar|चीनी|🍬
oil|तेल|🫒`,
  clothes: `shirt|कमीज़|👕
T-shirt|टी-शर्ट|👕
trousers|पतलून|👖|p
jeans|जींस|👖|p
shorts|निकर|🩳|p
dress|पोशाक / ड्रेस|👗
saree|साड़ी|🥻
kurta|कुर्ता|👘
skirt|स्कर्ट|👗
jacket|जैकेट|🧥
sweater|स्वेटर|🧶
coat|कोट|🧥
cap|टोपी|🧢
hat|हैट|👒
socks|मोज़े|🧦|p
shoes|जूते|👞|p
slippers|चप्पल|🩴|p
sandals|सैंडल|👡|p
belt|बेल्ट|➖
tie|टाई|👔
scarf|दुपट्टा / स्कार्फ़|🧣
gloves|दस्ताने|🧤|p
raincoat|बरसाती|🧥
watch|घड़ी (हाथ की)|⌚
glasses|चश्मा|👓|p
ring|अंगूठी|💍
earrings|झुमके / बालियाँ|💎|p
necklace|हार|📿
bag|थैला / बैग|👜
umbrella|छाता|☂️
wallet|बटुआ|👛
uniform|वर्दी|🎽`,
  colours: `red|लाल|🔴|a
blue|नीला|🔵|a
green|हरा|🟢|a
yellow|पीला|🟡|a
black|काला|⚫|a
white|सफ़ेद|⚪|a
orange|नारंगी|🟠|a
pink|गुलाबी|🌸|a
purple|बैंगनी|🟣|a
brown|भूरा|🟤|a
grey|स्लेटी|🩶|a
golden|सुनहरा|🟨|a
silver|चाँदी जैसा|🩶|a
circle|गोला / वृत्त|⭕
square|वर्ग|🟥
triangle|त्रिभुज|🔺
rectangle|आयत|▭
star|तारा|⭐
heart shape|दिल का आकार|❤️
oval|अंडाकार|🥚`,
  food: `rice|चावल|🍚|u
bread|रोटी / ब्रेड|🍞|u
chapati|चपाती|🫓
dal|दाल|🍲|u
curd|दही|🥣|u
milk|दूध|🥛|u
tea|चाय|🍵|u
coffee|कॉफ़ी|☕|u
water|पानी|💧|u
juice|जूस / रस|🧃|u
egg|अंडा|🥚
butter|मक्खन|🧈|u
ghee|घी|🫙|u
cheese|पनीर / चीज़|🧀|u
honey|शहद|🍯|u
sandwich|सैंडविच|🥪
biscuit|बिस्किट|🍪
cake|केक|🍰
ice cream|आइसक्रीम|🍨|u
soup|सूप|🍜|u
salad|सलाद|🥗
pickle|अचार|🫙|u
sweets|मिठाई|🍬|p
snacks|नाश्ता (हल्का)|🍿|p
breakfast|नाश्ता|🍳||I eat breakfast at eight.
lunch|दोपहर का खाना|🍱||Let's have lunch together.
dinner|रात का खाना|🍛||We eat dinner at nine.
flour|आटा|🌾|u
spices|मसाले|🌶️|p
chocolate|चॉकलेट|🍫|u`,
  nature: `sun|सूरज|☀️
moon|चाँद|🌙
stars|तारे|✨||Look at the stars tonight!
sky|आसमान|🌌
cloud|बादल|☁️
rain|बारिश|🌧️
wind|हवा|🌬️||The wind is very strong today.
storm|तूफ़ान|⛈️
thunder|बिजली की गड़गड़ाहट|🌩️||Did you hear the thunder last night?
lightning|बिजली (आसमानी)|⚡
rainbow|इंद्रधनुष|🌈
fog|कोहरा|🌫️||Drive slowly in the fog.
snow|बर्फ़|❄️
river|नदी|🏞️
lake|झील|🏞️
sea|समुद्र|🌊
mountain|पहाड़|⛰️
hill|पहाड़ी|⛰️
forest|जंगल|🌲
desert|रेगिस्तान|🏜️
beach|समुद्र तट|🏖️
island|द्वीप|🏝️
waterfall|झरना|💦
earth|धरती|🌍
stone|पत्थर|🪨
sand|रेत|⏳
soil|मिट्टी|🟫
fire|आग|🔥
season|मौसम (ऋतु)|🍂||Winter is my favourite season.
weather|मौसम|🌦️||The weather is pleasant today.`,
  transport: `bus|बस|🚌
train|रेलगाड़ी|🚆
car|कार|🚗
bicycle|साइकिल|🚲
motorbike|मोटरसाइकिल|🏍️
scooter|स्कूटर|🛵
auto-rickshaw|ऑटो रिक्शा|🛺
taxi|टैक्सी|🚕
truck|ट्रक|🚚
aeroplane|हवाई जहाज़|✈️
ship|पानी का जहाज़|🚢
boat|नाव|⛵
metro|मेट्रो|🚇
ambulance|एम्बुलेंस|🚑
tractor|ट्रैक्टर|🚜
bullock cart|बैलगाड़ी|🛞
helicopter|हेलीकॉप्टर|🚁
fire engine|दमकल|🚒
tram|ट्राम|🚋
van|वैन|🚐`,
  places: `hospital|अस्पताल|🏥
school|विद्यालय|🏫
market|बाज़ार|🛒
bank|बैंक|🏦
post office|डाकघर|🏤
police station|पुलिस थाना|🚓
railway station|रेलवे स्टेशन|🚉
bus stop|बस स्टॉप|🚏
airport|हवाई अड्डा|🛫
temple|मंदिर|🛕
mosque|मस्जिद|🕌
church|गिरजाघर|⛪
park|उद्यान / पार्क|🏞️
library|पुस्तकालय|📚
restaurant|भोजनालय|🍽️
hotel|होटल|🏨
cinema|सिनेमाघर|🎬
pharmacy|दवाई की दुकान|💊
office|दफ़्तर|🏢
factory|कारख़ाना|🏭
village|गाँव|🏡
city|शहर|🌆
bridge|पुल|🌉
road|सड़क|🛣️||Be careful when you cross the road.
shop|दुकान|🏪
zoo|चिड़ियाघर|🦁
playground|खेल का मैदान|🛝
museum|संग्रहालय|🏛️`,
  jobs: `doctor|डॉक्टर|👨‍⚕️
nurse|नर्स|👩‍⚕️
teacher|शिक्षक|👩‍🏫
engineer|इंजीनियर|👷
farmer|किसान|👨‍🌾
driver|चालक|🚖
cook|रसोइया|👨‍🍳
tailor|दर्ज़ी|🧵
carpenter|बढ़ई|🪚
plumber|नल ठीक करने वाला|🔧
electrician|बिजली मिस्त्री|💡
police officer|पुलिस अधिकारी|👮
soldier|सैनिक|🪖
lawyer|वकील|⚖️
shopkeeper|दुकानदार|🏪
barber|नाई|💈
postman|डाकिया|📮
pilot|विमान चालक|👨‍✈️
painter|चित्रकार / पेंटर|🎨
mechanic|मिस्त्री|🔧
cleaner|सफ़ाई कर्मचारी|🧹
security guard|चौकीदार|🛡️
accountant|लेखाकार|🧮
cashier|ख़ज़ांची|💵
receptionist|स्वागतकर्ता|🛎️`,
  emotions: `happy|ख़ुश|😊|a
sad|उदास|😢|a
angry|ग़ुस्से में|😠|a
excited|उत्साहित|🤩|a
tired|थका हुआ|😴|a
hungry|भूखा|😋|a
thirsty|प्यासा|🥤|a
scared|डरा हुआ|😨|a
nervous|घबराया हुआ|😬|a
bored|ऊबा हुआ|🥱|a
surprised|हैरान|😲|a
proud|गर्वित|🦚|a
worried|चिंतित|😟|a
calm|शांत|😌|a
confused|उलझन में|😕|a
lonely|अकेला|🥺|a
shy|शर्मीला|☺️|a
sick|बीमार|🤒|a
relaxed|आरामदायक / निश्चिंत|😎|a
confident|आत्मविश्वासी|💪|a`,
  actions: `wake up|जागना|⏰|v
brush my teeth|दाँत साफ़ करना|🪥|v
take a bath|नहाना|🛁|v
get dressed|कपड़े पहनना|👔|v
comb my hair|बाल बनाना|🪮|v
eat breakfast|नाश्ता करना|🍳|v
drink water|पानी पीना|💧|v
cook food|खाना बनाना|🍲|v
wash the dishes|बर्तन धोना|🧽|v
clean the house|घर साफ़ करना|🧹|v
wash my clothes|कपड़े धोना|🧺|v
go to work|काम पर जाना|💼|v
catch the bus|बस पकड़ना|🚌|v
read the newspaper|अख़बार पढ़ना|📰|v
check my phone|फ़ोन देखना|📱|v
call my parents|माता-पिता को फ़ोन करना|📞|v
water the plants|पौधों को पानी देना|🪴|v
buy vegetables|सब्ज़ियाँ ख़रीदना|🥕|v
walk in the park|पार्क में टहलना|🚶|v
watch TV|टीवी देखना|📺|v
do homework|गृहकार्य करना|📝|v
pay the bills|बिल भरना|🧾|v
lock the door|दरवाज़ा बंद करना|🔒|v
switch off the lights|बत्तियाँ बंद करना|💡|v
go to bed|सोने जाना|🛏️|v`,
  time: `morning|सुबह|🌅||I go for a walk in the morning.
afternoon|दोपहर|🌞||We have lunch in the afternoon.
evening|शाम|🌇||I come home in the evening.
night|रात|🌙||I sleep at night.
today|आज|📅||Today is a holiday.
tomorrow|कल (आने वाला)|➡️||I will call you tomorrow.
yesterday|कल (बीता हुआ)|⬅️||I met him yesterday.
week|सप्ताह|🗓️||A week has seven days.
month|महीना|🗓️||My salary comes every month.
year|साल|📆||This year I will learn English.
Monday|सोमवार|1️⃣||The office opens on Monday.
Tuesday|मंगलवार|2️⃣||I go to the temple on Tuesday.
Wednesday|बुधवार|3️⃣||We have a meeting on Wednesday.
Thursday|गुरुवार|4️⃣||The market is busy on Thursday.
Friday|शुक्रवार|5️⃣||Friday is the last working day.
Saturday|शनिवार|6️⃣||I clean my room on Saturday.
Sunday|रविवार|7️⃣||We visit our grandparents on Sunday.
hour|घंटा|⏳||The class is one hour long.
minute|मिनट|⏱️||Please wait one minute.
weekend|सप्ताहांत|🎉||What are your plans for the weekend?
birthday|जन्मदिन|🎂||My birthday is in March.
holiday|छुट्टी|🏖️||Diwali is a big holiday.`,
  school: `book|किताब|📘
notebook|कॉपी|📓
pen|कलम|🖊️
pencil|पेंसिल|✏️
eraser|रबड़|🧽
sharpener|शार्पनर|✏️
ruler|पटरी / स्केल|📏
scissors|कैंची|✂️|p
glue|गोंद|🧴
bag|बस्ता|🎒
blackboard|श्यामपट|⬛||The teacher is writing on the blackboard.
chalk|चॉक|🖍️
desk|डेस्क|🪑||My laptop is on the desk.
computer|कंप्यूटर|💻
laptop|लैपटॉप|💻
printer|प्रिंटर|🖨️
paper|काग़ज़|📄
file|फ़ाइल|📁
stapler|स्टेपलर|📎
calculator|कैलकुलेटर|🧮
diary|डायरी|📔
envelope|लिफ़ाफ़ा|✉️
map|नक्शा|🗺️
dictionary|शब्दकोश|📖`,
  sports: `cricket|क्रिकेट|🏏
football|फ़ुटबॉल|⚽
hockey|हॉकी|🏑
badminton|बैडमिंटन|🏸
tennis|टेनिस|🎾
kabaddi|कबड्डी|🤼
chess|शतरंज|♟️
carrom|कैरम|🎯
volleyball|वॉलीबॉल|🏐
basketball|बास्केटबॉल|🏀
swimming|तैराकी|🏊
running|दौड़ना|🏃
cycling|साइकिल चलाना|🚴
yoga|योग|🧘||I do yoga every morning.
wrestling|कुश्ती|🤼
table tennis|टेबल टेनिस|🏓
boxing|मुक्केबाज़ी|🥊
kite flying|पतंग उड़ाना|🪁
hide and seek|लुका-छिपी|🙈
skipping|रस्सी कूदना|🪢`,
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const DAILY_WORDS: DailyWord[] = DAILY_CATEGORIES.flatMap((c) =>
  RAW[c.id]
    .trim()
    .split("\n")
    .map((line) => {
      const [word, hi, emoji, flag = "", custom = ""] = line.split("|").map((x) => x.trim());
      return { id: `dn-${c.id}-${slug(word)}`, word, hi, emoji, category: c.id, flag, example: custom || c.example(word, { flag }) };
    }),
);

export const DAILY_BY_ID = new Map(DAILY_WORDS.map((w) => [w.id, w]));
export const DAILY_CATEGORY_BY_ID = new Map(DAILY_CATEGORIES.map((c) => [c.id, c]));
