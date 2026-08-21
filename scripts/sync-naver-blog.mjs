import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BLOG_ID = 'partir_12';
const RSS_URL = `https://rss.blog.naver.com/${BLOG_ID}.xml`;
const DATA_PATH = resolve('assets/noryangjin-blog-properties.json');
const IMAGE_DIR = resolve('assets/properties');
const RECENT_DAYS = 21;
const DRY_RUN = process.argv.includes('--dry-run');

const decode = value => String(value || '')
  .replace(/^<!\[CDATA\[/, '')
  .replace(/\]\]>$/, '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .trim();

const tag = (block, name) => {
  const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return decode(match?.[1]);
};

const dateInSeoul = value => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date(value));

const weekLabel = isoDate => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${year}년 ${month}월 ${Math.ceil(day / 7)}주차 확인매물`;
};

const listingStatus = (title, current = 'available') => {
  if (/거래\s*완료/.test(title)) return 'sold';
  if (/매도\s*보류|노출\s*종료|\[보류\]/.test(title)) return 'on_hold';
  return current;
};

const unitFromTitle = title => {
  if (/84\s*(?:㎡)?\s*(?:\+|와)\s*49/.test(title)) return '84+49';
  if (/59\s*(?:㎡)?\s*(?:\+|와)\s*59/.test(title)) return '59+59';
  if (/84.*상가|상가.*84/.test(title)) return '84+상가';
  return title.match(/(?:120|84[AB]?|74|59[AB]?)(?=\s|㎡|입주권|\)|,|$)/)?.[0] || '원문 확인';
};

const isListing = title => {
  const looksLikeListing = /매물|입주권/.test(title);
  const isRoundup = /총정리|현장\s*분석|재개발\s*소식|무순위|일반분양/.test(title);
  return looksLikeListing && !isRoundup;
};

const firstImageFromDescription = description => {
  const match = String(description || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  return decode(match?.[1]);
};

const advertisingDefaults = previous => ({
  reviewStatus: 'needs_review',
  propertyType: '재개발 조합원입주권',
  transactionType: '매매',
  location: '',
  areaSqm: null,
  floor: '',
  totalFloors: '',
  approvalDate: '',
  direction: '',
  directionBasis: '',
  rooms: null,
  bathrooms: null,
  moveInDate: '',
  parking: '',
  managementFee: null,
  managementFeeDetails: '',
  ...(previous?.advertising || {})
});

const imageExtension = url => {
  const match = String(url || '').match(/\.(png|jpe?g|webp)(?:\?|$)/i);
  const ext = match?.[1]?.toLowerCase();
  return ext === 'jpeg' ? 'jpg' : (ext || 'jpg');
};

const mirrorImage = async (id, sourceImageUrl, previous) => {
  if (!sourceImageUrl) return previous?.imageUrl || '';
  const imageUrl = `assets/properties/${id}.${imageExtension(sourceImageUrl)}`;
  if (previous?.sourceImageUrl === sourceImageUrl && previous?.imageUrl) {
    try {
      await access(resolve(previous.imageUrl));
      return previous.imageUrl;
    } catch {}
  }
  if (DRY_RUN) return previous?.imageUrl || imageUrl;
  const response = await fetch(sourceImageUrl, {
    headers: {
      referer: `https://blog.naver.com/${BLOG_ID}`,
      'user-agent': 'Mozilla/5.0 (compatible; property-feed/1.0)'
    }
  });
  if (!response.ok) {
    console.warn(`Image download skipped for ${id}: ${response.status}`);
    return previous?.imageUrl || '';
  }
  await mkdir(IMAGE_DIR, { recursive: true });
  await writeFile(resolve(imageUrl), Buffer.from(await response.arrayBuffer()));
  return imageUrl;
};

const response = await fetch(RSS_URL, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; property-feed/1.0)' } });
if (!response.ok) throw new Error(`Naver RSS request failed: ${response.status}`);
const xml = await response.text();
const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(match => {
  const block = match[1];
  const guid = tag(block, 'guid');
  const logNo = guid.match(/(\d+)$/)?.[1];
  const title = tag(block, 'title');
  const category = tag(block, 'category');
  const published = tag(block, 'pubDate');
  const description = tag(block, 'description');
  const sourceImageUrl = firstImageFromDescription(description);
  return { logNo, title, category, published, listedAt: dateInSeoul(published), sourceImageUrl };
});

const now = new Date();
const recentCutoff = new Date(now.getTime() - RECENT_DAYS * 86400000);
const recentListings = items.filter(item =>
  item.logNo &&
  /^노량진[1-8]구역$/.test(item.category) &&
  isListing(item.title) &&
  new Date(item.published) >= recentCutoff
);

const data = JSON.parse(await readFile(DATA_PATH, 'utf8'));
const existing = new Map(data.properties.map(property => [property.id, property]));

for (const item of recentListings) {
  const id = `BLOG-${item.logNo}`;
  const previous = existing.get(id);
  const status = listingStatus(item.title, previous?.status);
  const imageUrl = await mirrorImage(id, item.sourceImageUrl, previous);
  existing.set(id, {
    id,
    area: item.category,
    region: '노량진뉴타운',
    unit: previous?.unit || unitFromTitle(item.title),
    sale: previous?.sale ?? null,
    loan: previous?.loan ?? null,
    contribution: previous?.contribution ?? null,
    refund: previous?.refund ?? 0,
    initial: previous?.initial ?? null,
    total: previous?.total ?? null,
    status,
    inventory: previous?.inventory || 'owned',
    featured: previous?.featured ?? false,
    public: previous?.advertising?.reviewStatus === 'verified' && previous?.needsReview !== true ? (previous?.public ?? false) : false,
    listedAt: item.listedAt,
    verified: item.listedAt.replaceAll('-', '.'),
    verificationLabel: weekLabel(item.listedAt),
    soldAt: status === 'sold' ? (previous?.soldAt || item.listedAt) : previous?.soldAt,
    blogTitle: item.title,
    blogUrl: `https://blog.naver.com/${BLOG_ID}/${item.logNo}`,
    imageUrl,
    imageAlt: `${item.category} ${previous?.unit || unitFromTitle(item.title)} 입주권 대표 이미지`,
    media: imageUrl ? [{ type: 'image', role: 'cover', url: imageUrl, alt: `${item.category} ${previous?.unit || unitFromTitle(item.title)} 입주권 대표 이미지`, sourceUrl: item.sourceImageUrl || previous?.sourceImageUrl || '' }] : (previous?.media || []),
    sourceImageUrl: item.sourceImageUrl || previous?.sourceImageUrl || '',
    source: '네이버 블로그',
    advertising: advertisingDefaults(previous),
    needsReview: previous?.needsReview ?? (previous?.advertising?.reviewStatus !== 'verified'),
    dataNote: previous?.dataNote || (previous ? undefined : '새 블로그 매물입니다. 공개 금액은 관리자 확인 후 입력합니다.')
  });
}

data.source.asOf = dateInSeoul(now);
data.properties = [...existing.values()].sort((a, b) =>
  String(b.listedAt || '').localeCompare(String(a.listedAt || ''))
);

if (!DRY_RUN) await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`${DRY_RUN ? 'Checked' : 'Updated'} ${recentListings.length} recent Naver posts; ${data.properties.length} total property records.`);
