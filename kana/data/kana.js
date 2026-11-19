/* Explicit Kana Lookup Table, Row Definitions & Unified Pool Query (Instruction 5b-1 & 5b-2) */
(function (global) {
  'use strict';

  const KANA_ROWS = [
    { id: 'a', label: 'あ行', kana: ['あ', 'い', 'う', 'え', 'お'] },
    { id: 'ka', label: 'か行', kana: ['か', 'き', 'く', 'け', 'こ'] },
    { id: 'sa', label: 'さ行', kana: ['さ', 'し', 'す', 'せ', 'そ'] },
    { id: 'ta', label: 'た行', kana: ['た', 'ち', 'つ', 'て', 'と'] },
    { id: 'na', label: 'な行', kana: ['な', 'に', 'ぬ', 'ね', 'の'] },
    { id: 'ha', label: 'は行', kana: ['は', 'ひ', 'ふ', 'へ', 'ほ'] },
    { id: 'ma', label: 'ま行', kana: ['ま', 'み', 'む', 'め', 'も'] },
    { id: 'ya', label: 'や行', kana: ['や', 'ゆ', 'よ'] },
    { id: 'ra', label: 'ら行', kana: ['ら', 'り', 'る', 'れ', 'ろ'] },
    { id: 'wa', label: 'わ行', kana: ['わ', 'を', 'ん'] }
  ];

  const KANA_DATA = [
    // ==================== 清音 (seion: 46) ====================
    { id: 'kana_a_3042', hiragana: 'あ', katakana: 'ア', romaji: 'a', aliases: [], group: 'seion', row: 'a', advanced: false },
    { id: 'kana_i_3044', hiragana: 'い', katakana: 'イ', romaji: 'i', aliases: [], group: 'seion', row: 'a', advanced: false },
    { id: 'kana_u_3046', hiragana: 'う', katakana: 'ウ', romaji: 'u', aliases: [], group: 'seion', row: 'a', advanced: false },
    { id: 'kana_e_3048', hiragana: 'え', katakana: 'エ', romaji: 'e', aliases: [], group: 'seion', row: 'a', advanced: false },
    { id: 'kana_o_304a', hiragana: 'お', katakana: 'オ', romaji: 'o', aliases: [], group: 'seion', row: 'a', advanced: false },

    { id: 'kana_ka_304b', hiragana: 'か', katakana: 'カ', romaji: 'ka', aliases: [], group: 'seion', row: 'ka', advanced: false },
    { id: 'kana_ki_304d', hiragana: 'き', katakana: 'キ', romaji: 'ki', aliases: [], group: 'seion', row: 'ka', advanced: false },
    { id: 'kana_ku_304f', hiragana: 'く', katakana: 'ク', romaji: 'ku', aliases: [], group: 'seion', row: 'ka', advanced: false },
    { id: 'kana_ke_3051', hiragana: 'け', katakana: 'ケ', romaji: 'ke', aliases: [], group: 'seion', row: 'ka', advanced: false },
    { id: 'kana_ko_3053', hiragana: 'こ', katakana: 'コ', romaji: 'ko', aliases: [], group: 'seion', row: 'ka', advanced: false },

    { id: 'kana_sa_3055', hiragana: 'さ', katakana: 'サ', romaji: 'sa', aliases: [], group: 'seion', row: 'sa', advanced: false },
    { id: 'kana_shi_3057', hiragana: 'し', katakana: 'シ', romaji: 'shi', aliases: ['si'], group: 'seion', row: 'sa', advanced: false },
    { id: 'kana_su_3059', hiragana: 'す', katakana: 'ス', romaji: 'su', aliases: [], group: 'seion', row: 'sa', advanced: false },
    { id: 'kana_se_305b', hiragana: 'せ', katakana: 'セ', romaji: 'se', aliases: [], group: 'seion', row: 'sa', advanced: false },
    { id: 'kana_so_305d', hiragana: 'そ', katakana: 'ソ', romaji: 'so', aliases: [], group: 'seion', row: 'sa', advanced: false },

    { id: 'kana_ta_305f', hiragana: 'た', katakana: 'タ', romaji: 'ta', aliases: [], group: 'seion', row: 'ta', advanced: false },
    { id: 'kana_chi_3061', hiragana: 'ち', katakana: 'チ', romaji: 'chi', aliases: ['ti'], group: 'seion', row: 'ta', advanced: false },
    { id: 'kana_tsu_3064', hiragana: 'つ', katakana: 'ツ', romaji: 'tsu', aliases: ['tu'], group: 'seion', row: 'ta', advanced: false },
    { id: 'kana_te_3066', hiragana: 'て', katakana: 'テ', romaji: 'te', aliases: [], group: 'seion', row: 'ta', advanced: false },
    { id: 'kana_to_3068', hiragana: 'と', katakana: 'ト', romaji: 'to', aliases: [], group: 'seion', row: 'ta', advanced: false },

    { id: 'kana_na_306a', hiragana: 'な', katakana: 'ナ', romaji: 'na', aliases: [], group: 'seion', row: 'na', advanced: false },
    { id: 'kana_ni_306b', hiragana: 'に', katakana: 'ニ', romaji: 'ni', aliases: [], group: 'seion', row: 'na', advanced: false },
    { id: 'kana_nu_306c', hiragana: 'ぬ', katakana: 'ヌ', romaji: 'nu', aliases: [], group: 'seion', row: 'na', advanced: false },
    { id: 'kana_ne_306d', hiragana: 'ね', katakana: 'ネ', romaji: 'ne', aliases: [], group: 'seion', row: 'na', advanced: false },
    { id: 'kana_no_306e', hiragana: 'の', katakana: 'ノ', romaji: 'no', aliases: [], group: 'seion', row: 'na', advanced: false },

    { id: 'kana_ha_306f', hiragana: 'は', katakana: 'ハ', romaji: 'ha', aliases: [], group: 'seion', row: 'ha', advanced: false },
    { id: 'kana_hi_3072', hiragana: 'ひ', katakana: 'ヒ', romaji: 'hi', aliases: [], group: 'seion', row: 'ha', advanced: false },
    { id: 'kana_fu_3075', hiragana: 'ふ', katakana: 'フ', romaji: 'fu', aliases: ['hu'], group: 'seion', row: 'ha', advanced: false },
    { id: 'kana_he_3078', hiragana: 'へ', katakana: 'ヘ', romaji: 'he', aliases: [], group: 'seion', row: 'ha', advanced: false },
    { id: 'kana_ho_307b', hiragana: 'ほ', katakana: 'ホ', romaji: 'ho', aliases: [], group: 'seion', row: 'ha', advanced: false },

    { id: 'kana_ma_307e', hiragana: 'ま', katakana: 'マ', romaji: 'ma', aliases: [], group: 'seion', row: 'ma', advanced: false },
    { id: 'kana_mi_307f', hiragana: 'み', katakana: 'ミ', romaji: 'mi', aliases: [], group: 'seion', row: 'ma', advanced: false },
    { id: 'kana_mu_3080', hiragana: 'む', katakana: 'ム', romaji: 'mu', aliases: [], group: 'seion', row: 'ma', advanced: false },
    { id: 'kana_me_3081', hiragana: 'め', katakana: 'メ', romaji: 'me', aliases: [], group: 'seion', row: 'ma', advanced: false },
    { id: 'kana_mo_3082', hiragana: 'も', katakana: 'モ', romaji: 'mo', aliases: [], group: 'seion', row: 'ma', advanced: false },

    { id: 'kana_ya_3084', hiragana: 'や', katakana: 'ヤ', romaji: 'ya', aliases: [], group: 'seion', row: 'ya', advanced: false },
    { id: 'kana_yu_3086', hiragana: 'ゆ', katakana: 'ユ', romaji: 'yu', aliases: [], group: 'seion', row: 'ya', advanced: false },
    { id: 'kana_yo_3088', hiragana: 'よ', katakana: 'ヨ', romaji: 'yo', aliases: [], group: 'seion', row: 'ya', advanced: false },

    { id: 'kana_ra_3089', hiragana: 'ら', katakana: 'ラ', romaji: 'ra', aliases: [], group: 'seion', row: 'ra', advanced: false },
    { id: 'kana_ri_308a', hiragana: 'り', katakana: 'リ', romaji: 'ri', aliases: [], group: 'seion', row: 'ra', advanced: false },
    { id: 'kana_ru_308b', hiragana: 'る', katakana: 'ル', romaji: 'ru', aliases: [], group: 'seion', row: 'ra', advanced: false },
    { id: 'kana_re_308c', hiragana: 'れ', katakana: 'レ', romaji: 're', aliases: [], group: 'seion', row: 'ra', advanced: false },
    { id: 'kana_ro_308d', hiragana: 'ろ', katakana: 'ロ', romaji: 'ro', aliases: [], group: 'seion', row: 'ra', advanced: false },

    { id: 'kana_wa_308f', hiragana: 'わ', katakana: 'ワ', romaji: 'wa', aliases: [], group: 'seion', row: 'wa', advanced: false },
    { id: 'kana_wo_3092', hiragana: 'を', katakana: 'ヲ', romaji: 'wo', aliases: ['o'], group: 'seion', row: 'wa', advanced: false },
    { id: 'kana_n_3093', hiragana: 'ん', katakana: 'ン', romaji: 'n', aliases: ['nn', "n'"], group: 'seion', row: 'wa', advanced: false },

    // ==================== 浊音 (dakuon: 20) ====================
    { id: 'kana_ga_304c', hiragana: 'が', katakana: 'ガ', romaji: 'ga', aliases: [], group: 'dakuon', row: null, advanced: false },
    { id: 'kana_gi_304e', hiragana: 'ぎ', katakana: 'ギ', romaji: 'gi', aliases: [], group: 'dakuon', row: null, advanced: false },
    { id: 'kana_gu_3050', hiragana: 'ぐ', katakana: 'グ', romaji: 'gu', aliases: [], group: 'dakuon', row: null, advanced: false },
    { id: 'kana_ge_3052', hiragana: 'げ', katakana: 'ゲ', romaji: 'ge', aliases: [], group: 'dakuon', row: null, advanced: false },
    { id: 'kana_go_3054', hiragana: 'ご', katakana: 'ゴ', romaji: 'go', aliases: [], group: 'dakuon', row: null, advanced: false },

    { id: 'kana_za_3056', hiragana: 'ざ', katakana: 'ザ', romaji: 'za', aliases: [], group: 'dakuon', row: null, advanced: false },
    { id: 'kana_ji_3058', hiragana: 'じ', katakana: 'ジ', romaji: 'ji', aliases: ['zi'], group: 'dakuon', row: null, advanced: false },
    { id: 'kana_zu_305a', hiragana: 'ず', katakana: 'ズ', romaji: 'zu', aliases: [], group: 'dakuon', row: null, advanced: false },
    { id: 'kana_ze_305c', hiragana: 'ぜ', katakana: 'ゼ', romaji: 'ze', aliases: [], group: 'dakuon', row: null, advanced: false },
    { id: 'kana_zo_305e', hiragana: 'ぞ', katakana: 'ゾ', romaji: 'zo', aliases: [], group: 'dakuon', row: null, advanced: false },

    { id: 'kana_da_3060', hiragana: 'だ', katakana: 'ダ', romaji: 'da', aliases: [], group: 'dakuon', row: null, advanced: false },
    { id: 'kana_di_3062', hiragana: 'ぢ', katakana: 'ヂ', romaji: 'di', aliases: ['ji'], group: 'dakuon', row: null, advanced: true },
    { id: 'kana_du_3065', hiragana: 'づ', katakana: 'ヅ', romaji: 'du', aliases: ['zu'], group: 'dakuon', row: null, advanced: true },
    { id: 'kana_de_3067', hiragana: 'で', katakana: 'デ', romaji: 'de', aliases: [], group: 'dakuon', row: null, advanced: false },
    { id: 'kana_do_3069', hiragana: 'ど', katakana: 'ド', romaji: 'do', aliases: [], group: 'dakuon', row: null, advanced: false },

    { id: 'kana_ba_3070', hiragana: 'ば', katakana: 'バ', romaji: 'ba', aliases: [], group: 'dakuon', row: null, advanced: false },
    { id: 'kana_bi_3073', hiragana: 'び', katakana: 'ビ', romaji: 'bi', aliases: [], group: 'dakuon', row: null, advanced: false },
    { id: 'kana_bu_3076', hiragana: 'ぶ', katakana: 'ブ', romaji: 'bu', aliases: [], group: 'dakuon', row: null, advanced: false },
    { id: 'kana_be_3079', hiragana: 'べ', katakana: 'ベ', romaji: 'be', aliases: [], group: 'dakuon', row: null, advanced: false },
    { id: 'kana_bo_307c', hiragana: 'ぼ', katakana: 'ボ', romaji: 'bo', aliases: [], group: 'dakuon', row: null, advanced: false },

    // ==================== 半浊音 (handakuon: 5) ====================
    { id: 'kana_pa_3071', hiragana: 'ぱ', katakana: 'パ', romaji: 'pa', aliases: [], group: 'handakuon', row: null, advanced: false },
    { id: 'kana_pi_3074', hiragana: 'ぴ', katakana: 'ピ', romaji: 'pi', aliases: [], group: 'handakuon', row: null, advanced: false },
    { id: 'kana_pu_3077', hiragana: 'ぷ', katakana: 'プ', romaji: 'pu', aliases: [], group: 'handakuon', row: null, advanced: false },
    { id: 'kana_pe_307a', hiragana: 'ぺ', katakana: 'ペ', romaji: 'pe', aliases: [], group: 'handakuon', row: null, advanced: false },
    { id: 'kana_po_307d', hiragana: 'ぽ', katakana: 'ポ', romaji: 'po', aliases: [], group: 'handakuon', row: null, advanced: false },

    // ==================== 拗音 (yoon: 33) ====================
    { id: 'kana_kya_304d', hiragana: 'きゃ', katakana: 'キャ', romaji: 'kya', aliases: [], group: 'yoon', row: null, advanced: false },
    { id: 'kana_kyu_304d', hiragana: 'きゅ', katakana: 'キュ', romaji: 'kyu', aliases: [], group: 'yoon', row: null, advanced: false },
    { id: 'kana_kyo_304d', hiragana: 'きょ', katakana: 'キョ', romaji: 'kyo', aliases: [], group: 'yoon', row: null, advanced: false },

    { id: 'kana_sha_3057', hiragana: 'しゃ', katakana: 'シャ', romaji: 'sha', aliases: ['sya'], group: 'yoon', row: null, advanced: false },
    { id: 'kana_shu_3057', hiragana: 'しゅ', katakana: 'シュ', romaji: 'shu', aliases: ['syu'], group: 'yoon', row: null, advanced: false },
    { id: 'kana_sho_3057', hiragana: 'しょ', katakana: 'ショ', romaji: 'sho', aliases: ['syo'], group: 'yoon', row: null, advanced: false },

    { id: 'kana_cha_3061', hiragana: 'ちゃ', katakana: 'チャ', romaji: 'cha', aliases: ['tya'], group: 'yoon', row: null, advanced: false },
    { id: 'kana_chu_3061', hiragana: 'ちゅ', katakana: 'チュ', romaji: 'chu', aliases: ['tyu'], group: 'yoon', row: null, advanced: false },
    { id: 'kana_cho_3061', hiragana: 'ちょ', katakana: 'チョ', romaji: 'cho', aliases: ['tyo'], group: 'yoon', row: null, advanced: false },

    { id: 'kana_nya_306b', hiragana: 'にゃ', katakana: 'ニャ', romaji: 'nya', aliases: [], group: 'yoon', row: null, advanced: false },
    { id: 'kana_nyu_306b', hiragana: 'にゅ', katakana: 'ニュ', romaji: 'nyu', aliases: [], group: 'yoon', row: null, advanced: false },
    { id: 'kana_nyo_306b', hiragana: 'にょ', katakana: 'ニョ', romaji: 'nyo', aliases: [], group: 'yoon', row: null, advanced: false },

    { id: 'kana_hya_3072', hiragana: 'ひゃ', katakana: 'ヒャ', romaji: 'hya', aliases: [], group: 'yoon', row: null, advanced: false },
    { id: 'kana_hyu_3072', hiragana: 'ひゅ', katakana: 'ヒュ', romaji: 'hyu', aliases: [], group: 'yoon', row: null, advanced: false },
    { id: 'kana_hyo_3072', hiragana: 'ひょ', katakana: 'ヒョ', romaji: 'hyo', aliases: [], group: 'yoon', row: null, advanced: false },

    { id: 'kana_mya_307f', hiragana: 'みゃ', katakana: 'ミャ', romaji: 'mya', aliases: [], group: 'yoon', row: null, advanced: false },
    { id: 'kana_myu_307f', hiragana: 'みゅ', katakana: 'ミュ', romaji: 'myu', aliases: [], group: 'yoon', row: null, advanced: false },
    { id: 'kana_myo_307f', hiragana: 'みょ', katakana: 'ミョ', romaji: 'myo', aliases: [], group: 'yoon', row: null, advanced: false },

    { id: 'kana_rya_308a', hiragana: 'りゃ', katakana: 'リャ', romaji: 'rya', aliases: [], group: 'yoon', row: null, advanced: false },
    { id: 'kana_ryu_308a', hiragana: 'りゅ', katakana: 'リュ', romaji: 'ryu', aliases: [], group: 'yoon', row: null, advanced: false },
    { id: 'kana_ryo_308a', hiragana: 'りょ', katakana: 'リョ', romaji: 'ryo', aliases: [], group: 'yoon', row: null, advanced: false },

    { id: 'kana_gya_304e', hiragana: 'ぎゃ', katakana: 'ギャ', romaji: 'gya', aliases: [], group: 'yoon', row: null, advanced: false },
    { id: 'kana_gyu_304e', hiragana: 'ぎゅ', katakana: 'ギュ', romaji: 'gyu', aliases: [], group: 'yoon', row: null, advanced: false },
    { id: 'kana_gyo_304e', hiragana: 'ぎょ', katakana: 'ギョ', romaji: 'gyo', aliases: [], group: 'yoon', row: null, advanced: false },

    { id: 'kana_ja_3058', hiragana: 'じゃ', katakana: 'ジャ', romaji: 'ja', aliases: ['jya', 'zya'], group: 'yoon', row: null, advanced: false },
    { id: 'kana_ju_3058', hiragana: 'じゅ', katakana: 'ジュ', romaji: 'ju', aliases: ['jyu', 'zyu'], group: 'yoon', row: null, advanced: false },
    { id: 'kana_jo_3058', hiragana: 'じょ', katakana: 'ジョ', romaji: 'jo', aliases: ['jyo', 'zyo'], group: 'yoon', row: null, advanced: false },

    { id: 'kana_bya_3073', hiragana: 'びゃ', katakana: 'ビャ', romaji: 'bya', aliases: [], group: 'yoon', row: null, advanced: false },
    { id: 'kana_byu_3073', hiragana: 'びゅ', katakana: 'ビュ', romaji: 'byu', aliases: [], group: 'yoon', row: null, advanced: false },
    { id: 'kana_byo_3073', hiragana: 'びょ', katakana: 'ビョ', romaji: 'byo', aliases: [], group: 'yoon', row: null, advanced: false },

    { id: 'kana_pya_3074', hiragana: 'ぴゃ', katakana: 'ピャ', romaji: 'pya', aliases: [], group: 'yoon', row: null, advanced: false },
    { id: 'kana_pyu_3074', hiragana: 'ぴゅ', katakana: 'ピュ', romaji: 'pyu', aliases: [], group: 'yoon', row: null, advanced: false },
    { id: 'kana_pyo_3074', hiragana: 'ぴょ', katakana: 'ピョ', romaji: 'pyo', aliases: [], group: 'yoon', row: null, advanced: false },

    // ==================== 片假名特殊组合 (special: 23) ====================
    { id: 'kana_fa_30d5', hiragana: null, katakana: 'ファ', romaji: 'fa', aliases: [], group: 'special', row: null, advanced: false },
    { id: 'kana_fi_30d5', hiragana: null, katakana: 'フィ', romaji: 'fi', aliases: [], group: 'special', row: null, advanced: false },
    { id: 'kana_fe_30d5', hiragana: null, katakana: 'フェ', romaji: 'fe', aliases: [], group: 'special', row: null, advanced: false },
    { id: 'kana_fo_30d5', hiragana: null, katakana: 'フォ', romaji: 'fo', aliases: [], group: 'special', row: null, advanced: false },

    { id: 'kana_ti_30c6', hiragana: null, katakana: 'ティ', romaji: 'ti', aliases: [], group: 'special', row: null, advanced: false },
    { id: 'kana_di_30c7', hiragana: null, katakana: 'ディ', romaji: 'di', aliases: [], group: 'special', row: null, advanced: false },
    { id: 'kana_dyu_30c7', hiragana: null, katakana: 'デュ', romaji: 'dyu', aliases: [], group: 'special', row: null, advanced: false },
    { id: 'kana_tu_30c8', hiragana: null, katakana: 'トゥ', romaji: 'tu', aliases: [], group: 'special', row: null, advanced: false },
    { id: 'kana_du_30c9', hiragana: null, katakana: 'ドゥ', romaji: 'du', aliases: [], group: 'special', row: null, advanced: false },

    { id: 'kana_wi_30a6', hiragana: null, katakana: 'ウィ', romaji: 'wi', aliases: [], group: 'special', row: null, advanced: false },
    { id: 'kana_we_30a6', hiragana: null, katakana: 'ウェ', romaji: 'we', aliases: [], group: 'special', row: null, advanced: false },
    { id: 'kana_wo_30a6', hiragana: null, katakana: 'ウォ', romaji: 'wo', aliases: [], group: 'special', row: null, advanced: false },

    { id: 'kana_she_30b7', hiragana: null, katakana: 'シェ', romaji: 'she', aliases: [], group: 'special', row: null, advanced: false },
    { id: 'kana_je_30b8', hiragana: null, katakana: 'ジェ', romaji: 'je', aliases: [], group: 'special', row: null, advanced: false },
    { id: 'kana_che_30c1', hiragana: null, katakana: 'チェ', romaji: 'che', aliases: [], group: 'special', row: null, advanced: false },

    { id: 'kana_tsa_30c4', hiragana: null, katakana: 'ツァ', romaji: 'tsa', aliases: [], group: 'special', row: null, advanced: false },
    { id: 'kana_tse_30c4', hiragana: null, katakana: 'ツェ', romaji: 'tse', aliases: [], group: 'special', row: null, advanced: false },
    { id: 'kana_tso_30c4', hiragana: null, katakana: 'ツォ', romaji: 'tso', aliases: [], group: 'special', row: null, advanced: false },

    { id: 'kana_va_30f4', hiragana: null, katakana: 'ヴァ', romaji: 'va', aliases: [], group: 'special', row: null, advanced: false },
    { id: 'kana_vi_30f4', hiragana: null, katakana: 'ヴィ', romaji: 'vi', aliases: [], group: 'special', row: null, advanced: false },
    { id: 'kana_vu_30f4', hiragana: null, katakana: 'ヴ', romaji: 'vu', aliases: [], group: 'special', row: null, advanced: false },
    { id: 'kana_ve_30f4', hiragana: null, katakana: 'ヴェ', romaji: 've', aliases: [], group: 'special', row: null, advanced: false },
    { id: 'kana_vo_30f4', hiragana: null, katakana: 'ヴォ', romaji: 'vo', aliases: [], group: 'special', row: null, advanced: false }
  ];

  function validateKanaData(list) {
    const validGroups = new Set(['seion', 'dakuon', 'handakuon', 'yoon', 'special']);
    const seenIds = new Set();
    const counts = { seion: 0, dakuon: 0, handakuon: 0, yoon: 0, special: 0 };

    for (const item of list) {
      if (!item.id || seenIds.has(item.id)) {
        throw new Error(`KANA_DATA 校验失败：重复或缺失 id -> ${JSON.stringify(item)}`);
      }
      seenIds.add(item.id);

      if (!validGroups.has(item.group)) {
        throw new Error(`KANA_DATA 校验失败：非法 group -> ${JSON.stringify(item)}`);
      }
      counts[item.group] += 1;

      if (item.group === 'special') {
        if (item.hiragana !== null) {
          throw new Error(`KANA_DATA 校验失败：special 条目 hiragana 必须为 null -> ${JSON.stringify(item)}`);
        }
      } else {
        if (!item.hiragana || typeof item.hiragana !== 'string') {
          throw new Error(`KANA_DATA 校验失败：缺少 hiragana -> ${JSON.stringify(item)}`);
        }
        for (const ch of Array.from(item.hiragana)) {
          const cp = ch.codePointAt(0);
          if (cp < 0x3041 || cp > 0x3096) {
            throw new Error(`KANA_DATA 校验失败：平假名包含非法字符 "${ch}" (U+${cp.toString(16).toUpperCase()}) -> ${JSON.stringify(item)}`);
          }
        }
      }

      if (!item.katakana || typeof item.katakana !== 'string') {
        throw new Error(`KANA_DATA 校验失败：缺少 katakana -> ${JSON.stringify(item)}`);
      }
      for (const ch of Array.from(item.katakana)) {
        const cp = ch.codePointAt(0);
        const isValidKata = (cp >= 0x30A1 && cp <= 0x30F6) || (item.group === 'special' && cp === 0x30FC);
        if (!isValidKata) {
          throw new Error(`KANA_DATA 校验失败：片假名包含非法字符 "${ch}" (U+${cp.toString(16).toUpperCase()}) -> ${JSON.stringify(item)}`);
        }
      }

      if (!item.romaji || typeof item.romaji !== 'string') {
        throw new Error(`KANA_DATA 校验失败：缺少 romaji -> ${JSON.stringify(item)}`);
      }
      if (!Array.isArray(item.aliases)) {
        throw new Error(`KANA_DATA 校验失败：aliases 必须为数组 -> ${JSON.stringify(item)}`);
      }
      if (typeof item.advanced !== 'boolean') {
        throw new Error(`KANA_DATA 校验失败：advanced 必须为布尔值 -> ${JSON.stringify(item)}`);
      }
    }

    if (counts.seion !== 46 || (counts.dakuon + counts.handakuon) !== 25 || counts.yoon !== 33 || counts.special !== 23) {
      throw new Error(`KANA_DATA 数量校验失败：${JSON.stringify(counts)}`);
    }

    return {
      valid: true,
      total: list.length,
      counts: {
        '清音 (seion)': counts.seion,
        '浊音+半浊音 (dakuon+handakuon)': counts.dakuon + counts.handakuon,
        '拗音 (yoon)': counts.yoon,
        '特殊组合 (special)': counts.special
      }
    };
  }

  /**
   * 统一取词函数
   * @param {Object} opts
   * @param {string} opts.scope - seion / dakuon / handakuon / yoon / special / advanced / all
   * @param {string[]} opts.kinds - 当前模式所需字段，如 ['hiragana', 'katakana'] 或 ['katakana', 'romaji']
   * @param {boolean} [opts.includeAdvanced=false] - 是否在含罗马音模式下包含 advanced 条目
   */
  function getKanaPool({ scope = 'seion', kinds = ['hiragana', 'katakana'], includeAdvanced = false } = {}) {
    const reqKinds = Array.isArray(kinds) && kinds.length ? kinds : ['hiragana', 'katakana'];
    const usesRomaji = reqKinds.includes('romaji');
    const allowAdvanced = scope === 'advanced' || (!usesRomaji) || Boolean(includeAdvanced);

    return KANA_DATA.filter((item) => {
      if (!item || !item.id) return false;
      // 剔除缺少当前模式所需字段的条目（如 special 条目 hiragana 为 null，会自动跳过需要 hiragana 的模式）
      for (const k of reqKinds) {
        if (!item[k]) return false;
      }
      if (!allowAdvanced && item.advanced) return false;
      if (scope === 'all') return true;
      if (scope === 'advanced') return item.group === 'dakuon' || item.group === 'handakuon' || item.advanced;
      return item.group === scope;
    });
  }

  const report = validateKanaData(KANA_DATA);
  if (typeof console !== 'undefined' && console.info) {
    console.info('[Kana Match] KANA_DATA 校验通过:', report.counts);
  }

  global.KANA_ROWS = KANA_ROWS;
  global.KANA_DATA = KANA_DATA;
  global.validateKanaData = () => validateKanaData(KANA_DATA);
  global.getKanaPool = getKanaPool;
})(window);
