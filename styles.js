// الأنماط الفنية (24 نمطًا)
export const STYLES = [
  { id: 'cinematic', n: 'سينمائي', e: '🎬', p: 'cinematic film still, dramatic lighting, shallow depth of field, rich color grading, ultra detailed' },
  { id: 'cartoon3d', n: 'كرتون ثلاثي الأبعاد', e: '🧸', p: '3d animated movie style, soft global illumination, expressive stylized characters, vibrant colors' },
  { id: 'anime', n: 'أنمي', e: '🌸', p: 'anime film style, clean line art, hand-painted soft pastel backgrounds, expressive eyes, cel shading' },
  { id: 'watercolor', n: 'ألوان مائية', e: '🎨', p: 'delicate watercolor painting, soft bleeding colors, paper texture, gentle brush strokes' },
  { id: 'oil', n: 'رسم زيتي', e: '🖼️', p: 'classical oil painting, visible brush strokes, rich textures, warm museum lighting' },
  { id: 'sketch', n: 'رسم بالقلم', e: '✏️', p: 'detailed pencil sketch, graphite shading, cross hatching, white paper' },
  { id: 'comic', n: 'قصص مصورة', e: '💥', p: 'comic book illustration, bold ink outlines, halftone shading, dynamic composition, vivid colors' },
  { id: 'pixel', n: 'بكسل آرت', e: '👾', p: 'retro pixel art, 16-bit video game style, limited color palette, crisp pixels' },
  { id: 'lowpoly', n: 'لو بولي', e: '🔷', p: 'low poly 3d render, faceted geometric shapes, soft gradients, minimalist' },
  { id: 'clay', n: 'صلصال', e: '🧱', p: 'claymation stop-motion style, plasticine characters, fingerprints texture, tabletop miniature set' },
  { id: 'papercut', n: 'قصاصات ورق', e: '✂️', p: 'layered paper cut-out art, depth shadows between layers, craft paper textures' },
  { id: 'flat', n: 'فيكتور مسطح', e: '🟦', p: 'flat vector illustration, simple geometric shapes, bold solid colors, minimal shading' },
  { id: 'kids', n: 'كتاب أطفال', e: '📚', p: "children's picture book illustration, warm friendly characters, soft textured colors, whimsical" },
  { id: 'fantasy', n: 'فانتازيا', e: '🐉', p: 'epic fantasy concept art, magical atmosphere, glowing light, intricate detail' },
  { id: 'scifi', n: 'خيال علمي', e: '🚀', p: 'science fiction concept art, futuristic technology, volumetric lighting, sleek design' },
  { id: 'cyberpunk', n: 'سايبربانك', e: '🌃', p: 'cyberpunk city, neon lights, rain reflections, high contrast, moody night atmosphere' },
  { id: 'noir', n: 'أبيض وأسود', e: '🕵️', p: 'film noir black and white photography, high contrast, long shadows, grain' },
  { id: 'retro80', n: 'ريترو الثمانينات', e: '📼', p: '1980s retro style, synthwave colors, grainy vhs look, vintage poster aesthetics' },
  { id: 'photo', n: 'واقعي (صورة)', e: '📷', p: 'photorealistic photograph, natural lighting, 50mm lens, sharp focus, realistic skin and textures' },
  { id: 'popart', n: 'بوب آرت', e: '🟡', p: 'pop art style, bold primary colors, thick outlines, ben-day dots' },
  { id: 'impress', n: 'انطباعي', e: '🌅', p: 'impressionist painting, loose dabs of color, shimmering light, outdoor scenery' },
  { id: 'islamic', n: 'منمنمات شرقية', e: '🕌', p: 'ornate oriental miniature painting, intricate arabesque patterns, gold leaf details, rich jewel tones' },
  { id: 'chibi', n: 'تشيبي لطيف', e: '🐣', p: 'cute chibi style, big heads small bodies, pastel colors, kawaii, soft shading' },
  { id: 'gouache', n: 'غواش قصصي', e: '🍂', p: 'storybook gouache illustration, matte opaque paint, cozy warm palette, hand-painted look' },
];

export const CAMERAS = [
  { id: 'zoom-in', n: 'تقريب' },
  { id: 'zoom-out', n: 'ابتعاد' },
  { id: 'pan-left', n: 'تحريك لليسار' },
  { id: 'pan-right', n: 'تحريك لليمين' },
  { id: 'none', n: 'ثابت' },
];

export const VOICES = [
  { id: 'nova', n: 'نوفا (أنثى)' },
  { id: 'shimmer', n: 'شيمر (أنثى)' },
  { id: 'alloy', n: 'ألوي (محايد)' },
  { id: 'echo', n: 'إيكو (ذكر)' },
  { id: 'fable', n: 'فيبل (ذكر)' },
  { id: 'onyx', n: 'أونيكس (ذكر عميق)' },
];

export const LANGS = [
  { id: 'Arabic', n: 'العربية' },
  { id: 'English', n: 'English' },
  { id: 'French', n: 'Français' },
  { id: 'Spanish', n: 'Español' },
  { id: 'German', n: 'Deutsch' },
  { id: 'Turkish', n: 'Türkçe' },
  { id: 'Hindi', n: 'हिन्दी' },
  { id: 'Urdu', n: 'اردو' },
  { id: 'Indonesian', n: 'Indonesia' },
  { id: 'Russian', n: 'Русский' },
  { id: 'Chinese', n: '中文' },
  { id: 'Japanese', n: '日本語' },
];

export const RATIO_LIST = [
  { id: '16:9', n: 'عرضي 16:9', w: 1280, h: 720, gw: 1024, gh: 576 },
  { id: '9:16', n: 'طولي 9:16', w: 720, h: 1280, gw: 576, gh: 1024 },
  { id: '1:1', n: 'مربع 1:1', w: 960, h: 960, gw: 768, gh: 768 },
];

export const TEMPLATES = [
  { n: 'قصة أطفال', t: 'في غابة هادئة يعيش أرنب صغير اسمه زيزو يحب الجزر والمغامرات. ذات صباح وجد خريطة قديمة تحت شجرة بلوط عملاقة، فقرر أن يتبعها ليكتشف الكنز المخبأ. في الطريق ساعده سنجاب ذكي اسمه سمسم وبومة حكيمة تدعى نورة. عبروا النهر وتسلقوا التل، وفي النهاية وجدوا أن الكنز هو صندوق مليء بالبذور التي زرعوها فصارت الغابة أجمل.' },
  { n: 'حكاية خيالية', t: 'كانت هناك أميرة شجاعة تدعى ليلى تعيش في قلعة فوق الغيوم. عندما سرق تنين صغير نجمة الصباح من السماء، ركبت ليلى بساطًا سحريًا وطارت خلفه. اكتشفت أن التنين لم يسرقها شرًا بل لأنه كان وحيدًا ويريد أن يضيء كهفه المظلم. اتفقت معه أن يزورها كل مساء مقابل إعادة النجمة، وصارا صديقين.' },
  { n: 'قصة تعليمية عن الفضاء', t: 'يسافر رائد الفضاء الصغير سامي على متن مركبته الفضية في رحلة عبر المجموعة الشمسية. يبدأ من الشمس التي تمنح الجميع الضوء والحرارة، ثم يمر بعطارد والزهرة والأرض بزرقتها الجميلة، ثم المريخ الأحمر والمشتري العملاق وحلقات زحل. في كل كوكب يتعلم معلومة جديدة ويعود في النهاية إلى الأرض ليحكي لأصدقائه ما رآه.' },
  { n: 'إعلان منتج', t: 'صباح مزدحم في مدينة صاخبة، رجل متعب يبحث عن لحظة هدوء. يفتح علبة قهوة جديدة فتنتشر رائحتها الدافئة ويتغير كل شيء من حوله. تصبح الألوان أجمل والوجوه أكثر ابتسامًا. يرفع كوبه ويبتسم: قهوة تبدأ بها يومك بشكل مختلف.' },
  { n: 'قصة مغامرة', t: 'استيقظ الفتى كريم على صوت غريب قادم من العلية. صعد ليكتشف بوابة صغيرة متوهجة بين الصناديق القديمة. عبر البوابة فوجد نفسه في عالم من الجزر الطائرة والمدن الزجاجية. التقى بروبوت لطيف اسمه بولت يحتاج مساعدته لإعادة مصدر الطاقة المسروق، وخاضا معًا مغامرة لإنقاذ هذا العالم الساحر.' },
  { n: 'حكمة وعبرة', t: 'في قرية على سفح جبل عاش نجار عجوز اسمه عم صالح، وكان كل يوم يصنع كرسيًا ويقدمه هدية لأول محتاج يلقاه. سأله شاب لماذا لا يبيعها، فابتسم وقال إن الخير الذي تعطيه يعود إليك بطرق لا تتوقعها. وفي الشتاء القاسي طرق أهل القرية بابه حاملين الحطب والطعام شكرًا له.' },
  { n: 'قصة رعب خفيفة', t: 'ليلة عاصفة، دخل أربعة أصدقاء بيتًا مهجورًا على أطراف المدينة بحثًا عن مأوى. سمعوا خطوات في الطابق العلوي وأضواء تومض. وبعد بحث متوتر اكتشفوا أن المصدر قطة صغيرة وجهاز راديو قديم يعمل من تلقاء نفسه. ضحكوا وقرروا إصلاح البيت ليصبح مقهاهم السري.' },
  { n: 'قصة ملهمة', t: 'ولدت سلمى في قرية صغيرة وكانت تحلم بأن تصبح عالمة فلك. كانت تراقب النجوم كل ليلة بمنظار صنعته من أنابيب قديمة. سخر منها البعض لكنها لم تتوقف عن الدراسة والتعلم. بعد سنوات طويلة من الاجتهاد، اكتشفت مذنبًا جديدًا يحمل اسمها ليبقى في السماء إلى الأبد.' },
];
