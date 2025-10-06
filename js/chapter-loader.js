// js/chapter-loader.js

/**
 * Hàm khởi tạo bộ tải chương.
 * @param {string} storyPath - Tên thư mục chứa các tệp JSON (ví dụ: 'legnaxe_part1').
 * @param {number} totalChapters - Tổng số chương (không bao gồm epilogue/after-credit).
 * @param {boolean} hasSpecialChapter - Có hay không có chương đặc biệt (epilogue/after-credit).
 * @param {string} initialLang - Ngôn ngữ ban đầu ('en', 'vi' hoặc 'zh').
 */
function initializeChapterLoader(storyPath, totalChapters, hasSpecialChapter, initialLang = 'vi') {
    // Biến lưu trữ trạng thái hiện tại
    let currentChapterIndex = 0; // Chỉ số chương hiện tại trong chapterIds
    const chapterIds = []; // Mảng lưu trữ ID của các chương
    const isPart1 = storyPath.includes('part1');
    // Lấy ngôn ngữ đã lưu, nếu không có thì lấy ngôn ngữ khởi tạo, nếu vẫn không có thì lấy 'vi'
    let lang = localStorage.getItem(`lang_${storyPath}`) || initialLang || 'vi'; 
    
    // Biến cho Text-to-Speech (TTS)
    let isSpeaking = false;
    let synth = null;
    let currentUtterance = null;
    let currentChapterData = null;
    let vietnameseVoice = null; // Giọng đọc tiếng Việt được chọn
    let chineseVoice = null;    // Giọng đọc tiếng Trung được chọn
    const speechSupported = 'speechSynthesis' in window;
    
    // Lấy các phần tử DOM cần thiết
    const dynamicContent = document.getElementById('dynamic-chapter-content');
    const prevBtn = document.getElementById('prev-chapter-btn');
    const nextBtn = document.getElementById('next-chapter-btn');
    const listBtn = document.getElementById('list-chapter-btn');
    const chapterModal = document.getElementById('chapter-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalList = document.getElementById('modal-chapter-list');
    
    // Các phần tử Progress Bar
    const overallProgressBar = document.getElementById('overall-progress-bar');
    const scrollProgressBar = document.getElementById('scroll-progress-bar');

    // Các phần tử cho TTS và Chuyển đổi Ngôn ngữ
    const ttsButton = document.getElementById('tts-toggle-btn');
    const ttsIcon = document.getElementById('tts-icon');
    const ttsText = document.getElementById('tts-text');
    
    // Khai báo thêm Lang Switch Button
    const langSwitchButton = document.getElementById('lang-switch-btn');
    const langSwitchText = document.getElementById('lang-switch-text');


    // Khởi tạo Speech Synthesis API nếu được hỗ trợ
    if (speechSupported) {
        synth = window.speechSynthesis;
        if (synth.onvoiceschanged !== undefined) {
            synth.onvoiceschanged = initializeVoices;
        }
        initializeVoices(); // Gọi lần đầu
    }

    /**
     * Tìm và thiết lập giọng đọc cho Tiếng Việt và Tiếng Trung.
     */
    function initializeVoices() {
        if (!synth) return;
        
        const voices = synth.getVoices();
        
        // Thiết lập giọng Tiếng Việt
        const preferredViVoices = ["Google Vietnamese", "Microsoft An", "Microsoft Hoai"];
        vietnameseVoice = voices.find(voice => 
            voice.lang === 'vi-VN' && preferredViVoices.some(name => voice.name.includes(name))
        ) || voices.find(voice => voice.lang === 'vi-VN');
        
        // Thiết lập giọng Tiếng Trung (zh-CN, zh-TW)
        const preferredZhVoices = ["Google Mandarin", "Microsoft Kangkang", "Microsoft Huihui", "Google 普通话（中国大陆）"];
        chineseVoice = voices.find(voice => 
            (voice.lang === 'zh-CN' || voice.lang === 'zh-TW') && preferredZhVoices.some(name => voice.name.includes(name))
        ) || voices.find(voice => voice.lang.startsWith('zh-'));


        if (!vietnameseVoice) console.warn("Không tìm thấy giọng đọc Tiếng Việt cụ thể.");
        if (!chineseVoice) console.warn("Không tìm thấy giọng đọc Tiếng Trung cụ thể.");
    }


    // Hàm đóng modal
    function closeModal() {
        chapterModal.classList.remove('modal-active');
        setTimeout(() => {
            if (!chapterModal.classList.contains('modal-active')) {
                chapterModal.style.display = 'none';
            }
        }, 300);
        document.body.style.overflow = '';
    }
    window.closeModal = closeModal;


    // 1. Khởi tạo danh sách ID và danh sách hiển thị (modal)
    function initChapterList() {
        modalList.innerHTML = '';
        
        // Thêm các chương chính
        for (let i = 1; i <= totalChapters; i++) {
            const chapterId = `chapter-${i}`;
            chapterIds.push(chapterId);
            
            const chapterTitle = lang === 'en' ? `Chapter ${i}` : (lang === 'zh' ? `第${i}章` : `Chương ${i}`);
            const listItem = document.createElement('li');
            const link = document.createElement('a');
            link.href = `#${chapterId}`;
            link.dataset.chapterId = chapterId;
            link.className = 'modal-chapter-link block p-3 rounded-md text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors';
            link.textContent = chapterTitle;
            listItem.appendChild(link);
            modalList.appendChild(listItem);
        }

        // Thêm epilogue/after-credit nếu có
        if (hasSpecialChapter) {
            const specialId = isPart1 ? 'epilogue' : 'after-credit';
            chapterIds.push(specialId);
            
            const listItem = document.createElement('li');
            const link = document.createElement('a');
            link.href = `#${specialId}`;
            link.dataset.chapterId = specialId;
            link.className = 'modal-chapter-link block p-3 rounded-md text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-semibold';
            listItem.appendChild(link);
            modalList.appendChild(listItem);

            // Cập nhật tiêu đề đặc biệt (cần tải tiêu đề trước)
            link.textContent = isPart1 
                               ? (lang === 'en' ? 'Epilogue: The Rebalancing' : (lang === 'zh' ? '尾声：再平衡' : 'Khúc Vĩ Thanh: Sự Tái Cân Bằng'))
                               : (lang === 'en' ? 'After-Credit' : (lang === 'zh' ? '后续' : 'Phần Sau'));
        }

        // Tải tiêu đề cho tất cả các chương và lưu vào dataset
        loadAllChapterTitles();
    }

    // 2. Hàm tải tiêu đề cho tất cả các chương để điền vào modal
    async function loadAllChapterTitles() {
        const modalLinks = modalList.querySelectorAll('.modal-chapter-link');
        
        for (let i = 0; i < chapterIds.length; i++) {
            const chapterId = chapterIds[i];
            const modalLink = modalLinks[i];

            let fileName = '';
            if (chapterId === 'epilogue') {
                fileName = 'epilogue.json';
            } else if (chapterId === 'after-credit') {
                 fileName = 'after-credit.json';
            } else {
                const num = chapterId.split('-')[1];
                fileName = `chapter_${num.padStart(2, '0')}.json`;
            }
            
            try {
                const path = `../data/novels/${storyPath}/${fileName}`;
                const response = await fetch(path);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    // LƯU TRỮ TIÊU ĐỀ ĐA NGÔN NGỮ VÀO DATASET
                    modalLink.dataset.titleVi = data['title_vi'] || `Chương ${i + 1}`;
                    modalLink.dataset.titleEn = data['title_en'] || `Chapter ${i + 1}`;
                    // Đảm bảo hỗ trợ Tiếng Trung
                    modalLink.dataset.titleZh = data['title_zh'] || `第 ${i + 1} 章`; 

                    // Cập nhật tiêu đề theo ngôn ngữ hiện tại
                    const title = data[`title_${lang}`] || data.title_en || modalLink.textContent;
                    modalLink.textContent = title;
                } else {
                    console.error(`Error loading title (404) for ${path}`);
                }
            } catch (error) {
                modalLink.textContent = modalLink.textContent + ` (Lỗi tải)`;
                console.error(`Error loading title for ${chapterId}:`, error);
            }
        }
    }


    // 3. Hàm lấy nội dung chương từ JSON
    async function fetchChapterContent(chapterId) {
        stopSpeaking(); // Dừng TTS trước khi tải chương mới
        
        dynamicContent.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 p-8">Đang tải nội dung chương...</p>`;

        try {
            let fileName = '';
            if (chapterId === 'epilogue') {
                fileName = 'epilogue.json';
            } else if (chapterId === 'after-credit') {
                 fileName = 'after-credit.json';
            } else {
                const num = chapterId.split('-')[1];
                fileName = `chapter_${num.padStart(2, '0')}.json`; 
            }

            const path = `../data/novels/${storyPath}/${fileName}`;

            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Could not load chapter file (${response.status}): ${path}`);
            }
            const data = await response.json();
            
            currentChapterData = data; // Lưu trữ dữ liệu tải về
            
            return data;
        } catch (error) {
            console.error('Error fetching chapter content:', error);
            dynamicContent.innerHTML = `<p class="text-red-500 dark:text-red-400 p-4 text-center">Lỗi: Không thể tải nội dung chương ${chapterId}. Vui lòng kiểm tra lại đường dẫn file JSON.</p>`;
            return null;
        }
    }

    // 4. Hàm hiển thị nội dung chương (Sử dụng dữ liệu đã có trong currentChapterData)
    function renderChapter(scrollToSavedPosition = false) {
        if (!currentChapterData) {
            dynamicContent.innerHTML = '<p class="text-red-500 dark:text-red-400">Không thể hiển thị nội dung chương.</p>';
            return;
        }
        
        // Lấy tiêu đề và nội dung theo ngôn ngữ hiện tại
        const titleKey = `title_${lang}`;
        const contentKey = `content_${lang}`;

        const title = currentChapterData[titleKey] || currentChapterData.title_en || 'Chapter Title';
        const content = currentChapterData[contentKey] || currentChapterData.content_en || '<p>Content not available in this language or corrupted.</p>';
        
        const currentChapterId = chapterIds[currentChapterIndex];
        const partNumber = storyPath.includes('part1') ? '1' : '2';

        // Xây dựng HTML cho nội dung chương
        const contentHtml = `
            <h3 class="text-2xl sm:text-3xl font-serif font-bold mb-4 text-gray-900 dark:text-white">${title}</h3>
            <div class="prose dark:prose-invert">
                ${content}
            </div>
        `;
        dynamicContent.innerHTML = contentHtml;

        // Cập nhật tiêu đề trang
        document.title = `${title} - LEGNAXE Part ${partNumber} (${currentChapterId})`;
        
        // Cuộn đến vị trí đã lưu hoặc đầu nội dung
        if (scrollToSavedPosition) {
            loadScrollPosition(currentChapterId);
        } else {
            const mainElement = document.querySelector('main');
            // Cuộn lên đầu phần nội dung chính
            const headerOffset = document.getElementById('navbar') ? document.getElementById('navbar').offsetHeight : 80;
            window.scrollTo({ top: mainElement.offsetTop - headerOffset, behavior: 'smooth' });
        }
        
        // Cập nhật lại nút TTS và Progress Bar
        updateSpeechButton();
        updateProgressBar();
    }
    
    // --- TTS LOGIC ---
    
    function stopSpeaking() {
        if (synth && synth.speaking) {
            synth.cancel();
            isSpeaking = false;
            updateSpeechButton();
        }
    }

    function updateSpeechButton() {
        if (!ttsButton || !ttsIcon || !ttsText) return;

        if (!speechSupported) {
             ttsButton.disabled = true;
             ttsButton.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'bg-indigo-600', 'hover:bg-indigo-700');
             ttsButton.classList.add('bg-gray-400', 'cursor-not-allowed', 'dark:bg-gray-600');
             ttsIcon.className = 'fas fa-volume-off mr-2';
             ttsText.textContent = (lang === 'vi' ? 'Không hỗ trợ' : (lang === 'zh' ? '不支持' : 'Not Supported'));
             return;
        }

        ttsButton.disabled = false;
        ttsButton.classList.remove('bg-gray-400', 'cursor-not-allowed', 'dark:bg-gray-600');
        ttsButton.classList.add('bg-indigo-600', 'hover:bg-indigo-700', 'dark:bg-indigo-700', 'dark:hover:bg-indigo-800');

        if (isSpeaking) {
            ttsIcon.className = 'fas fa-pause mr-2';
            ttsText.textContent = (lang === 'vi' ? 'Tạm dừng' : (lang === 'zh' ? '暂停' : 'Pause'));
        } else {
            ttsIcon.className = 'fas fa-play mr-2';
            ttsText.textContent = (lang === 'vi' ? 'Nghe truyện' : (lang === 'zh' ? '朗读故事' : 'Read Story'));
        }
    }
    
    function toggleSpeech() {
        if (!speechSupported || !currentChapterData) return;

        if (isSpeaking) {
            stopSpeaking();
        } else {
            if (synth.speaking) {
                 synth.cancel();
            }

            const title = currentChapterData[`title_${lang}`] || currentChapterData.title_en || 'Chapter Title';
            const content = currentChapterData[`content_${lang}`] || currentChapterData.content_en || '';
            
            const plainContent = content.replace(/<[^>]*>/g, ' ').replace(/\s{2,}/g, ' ').trim();
            const textToSpeak = `${title}. ${plainContent}`;

            currentUtterance = new SpeechSynthesisUtterance(textToSpeak);
            
            // Thiết lập ngôn ngữ và giọng đọc
            if (lang === 'vi') {
                currentUtterance.lang = 'vi-VN';
                if (vietnameseVoice) currentUtterance.voice = vietnameseVoice;
            } else if (lang === 'zh') {
                currentUtterance.lang = 'zh-CN';
                if (chineseVoice) currentUtterance.voice = chineseVoice;
            } else { // 'en'
                currentUtterance.lang = 'en-US';
            }

            currentUtterance.rate = 0.9;
            
            currentUtterance.onstart = () => {
                isSpeaking = true;
                updateSpeechButton();
            };

            currentUtterance.onend = () => {
                isSpeaking = false;
                updateSpeechButton();
            };

            currentUtterance.onerror = (event) => {
                console.error('Speech Synthesis Error:', event.error);
                isSpeaking = false;
                updateSpeechButton();
            };

            synth.speak(currentUtterance);
        }
    }
    
    // --- CHỨC NĂNG MỚI: CHUYỂN ĐỔI NGÔN NGỮ ĐA TRẠNG THÁI ---

    const languages = ['vi', 'en', 'zh'];

    /**
     * Chuyển đổi ngôn ngữ hiển thị theo thứ tự VI -> EN -> ZH -> VI.
     */
    function switchLanguage() {
        stopSpeaking(); 
        
        // 1. Tìm ngôn ngữ tiếp theo
        const currentIndex = languages.indexOf(lang);
        const nextIndex = (currentIndex + 1) % languages.length;
        lang = languages[nextIndex];
        
        // 2. Lưu trạng thái ngôn ngữ
        localStorage.setItem(`lang_${storyPath}`, lang);
        
        // 3. Cập nhật giao diện nút chuyển đổi ngôn ngữ
        updateLangSwitchButton();
        
        // 4. Cập nhật nội dung hiển thị (từ currentChapterData)
        if (currentChapterData) {
            // Không cuộn về vị trí đã lưu sau khi chuyển ngôn ngữ, chỉ render lại nội dung
            renderChapter(false); 
        }
        
        // 5. Cập nhật tiêu đề trong Modal
        updateModalTitles();
        
        // 6. Cập nhật trạng thái nút TTS (để hiển thị đúng nhãn)
        updateSpeechButton();
        
        console.log(`Ngôn ngữ đã chuyển sang: ${lang}`);
    }
    
    /**
     * Cập nhật tiêu đề trong modal theo ngôn ngữ mới
     */
    function updateModalTitles() {
        const modalLinks = modalList.querySelectorAll('.modal-chapter-link');
        modalLinks.forEach(link => {
            // Lấy key tiêu đề theo ngôn ngữ mới (ví dụ: titleVi, titleEn, titleZh)
            const titleKey = `title${lang.charAt(0).toUpperCase() + lang.slice(1)}`;
            const title = link.dataset[titleKey] || link.dataset.titleEn;
            if (title) {
                link.textContent = title;
            }
        });
    }

    /**
     * Cập nhật giao diện nút chuyển đổi ngôn ngữ
     */
    function updateLangSwitchButton() {
        if (!langSwitchButton || !langSwitchText) return;
        
        // Đặt màu nền mặc định là xanh dương
        langSwitchButton.classList.remove('bg-green-600', 'hover:bg-green-700', 'dark:bg-green-700', 'dark:hover:bg-green-800');
        langSwitchButton.classList.add('bg-blue-600', 'hover:bg-blue-700', 'dark:bg-blue-700', 'dark:hover:bg-blue-800');

        if (lang === 'vi') {
            langSwitchText.textContent = 'Switch to English / 切换到中文';
        } else if (lang === 'en') {
            langSwitchText.textContent = 'Chuyển sang Tiếng Việt / 切换到中文';
        } else if (lang === 'zh') {
            langSwitchText.textContent = 'Switch to Vietnamese / Chuyển sang Tiếng Việt';
            // Màu sắc đặc trưng cho ngôn ngữ thứ 3 (ví dụ: xanh lá cây)
            langSwitchButton.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'dark:bg-blue-700', 'dark:hover:bg-blue-800');
            langSwitchButton.classList.add('bg-green-600', 'hover:bg-green-700', 'dark:bg-green-700', 'dark:hover:bg-green-800');
        }
    }

    // --- CHỨC NĂNG MỚI: LƯU VÀ TẢI VỊ TRÍ ĐỌC ---

    // Key để lưu trạng thái
    const storageKey = `novelState_${storyPath}`;
    
    /**
     * Lưu trạng thái đọc hiện tại (Chương và Vị trí cuộn).
     */
    function saveState() {
        if (chapterIds.length === 0) return;
        
        // Lấy vị trí cuộn hiện tại của cửa sổ
        const scrollPosition = window.pageYOffset; 
        
        const state = {
            chapterId: chapterIds[currentChapterIndex],
            scrollPosition: scrollPosition
        };
        try {
            localStorage.setItem(storageKey, JSON.stringify(state));
        } catch (e) {
            console.warn('Không thể lưu trạng thái đọc vào LocalStorage.', e);
        }
    }
    
    /**
     * Tải vị trí cuộn đã lưu và cuộn đến vị trí đó.
     */
    function loadScrollPosition(chapterId) {
        try {
            const savedState = JSON.parse(localStorage.getItem(storageKey));
            if (savedState && savedState.chapterId === chapterId) {
                // Đảm bảo cuộn sau khi nội dung đã render xong
                window.setTimeout(() => {
                    // Sử dụng behavior: 'instant' để tránh giật hình khi tải trang
                    window.scrollTo({ top: savedState.scrollPosition, behavior: 'instant' });
                }, 100); 
                return true;
            }
        } catch (e) {
            console.error('Lỗi khi tải trạng thái cuộn:', e);
        }
        return false;
    }
    
    // Gắn sự kiện lưu trạng thái khi người dùng cuộn
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        // Tránh lưu trạng thái quá thường xuyên
        scrollTimeout = setTimeout(saveState, 500); 
        updateProgressBar();
    });
    
    // --- Kết thúc Chức năng Lưu/Tải ---


    // 6. Hàm điều hướng chính (Chỉ tải dữ liệu nếu chưa có)
    async function navigateToChapter(chapterId, loadSavedScroll = false) {
        stopSpeaking();
        
        const targetIndex = chapterIds.indexOf(chapterId);
        const currentChapterId = chapterIds[currentChapterIndex];

        // Nếu chuyển đến chương mới, hoặc đang ở chương cũ nhưng chưa có data (lần tải đầu)
        if (currentChapterId !== chapterId || !currentChapterData) {
            const chapterData = await fetchChapterContent(chapterId);
            if (!chapterData) {
                return;
            }
        }
        
        // Sau khi tải (hoặc đã có data), render chapter
        currentChapterIndex = targetIndex !== -1 ? targetIndex : 0;
        
        // Kiểm tra xem có cần tải vị trí cuộn đã lưu không
        renderChapter(loadSavedScroll);
        
        // Cập nhật chỉ số chương hiện tại và trạng thái nút
        updateNavigationButtons();
        
        // Cập nhật URL hash
        if (window.location.hash.substring(1) !== chapterId) {
            window.location.hash = chapterId;
        }
    }


    // 7. Hàm cập nhật trạng thái nút điều hướng
    function updateNavigationButtons() {
        prevBtn.disabled = currentChapterIndex <= 0;
        nextBtn.disabled = currentChapterIndex >= chapterIds.length - 1;
        
        prevBtn.classList.toggle('opacity-50', prevBtn.disabled);
        nextBtn.classList.toggle('opacity-50', nextBtn.disabled);
    }
    
    // 8. Hàm cập nhật thanh tiến trình đọc (Progress Bar Kép)
    function updateProgressBar() {
        const chapterContent = dynamicContent.querySelector('.prose');
        if (!chapterContent || chapterIds.length === 0) return;

        // 1. Tiến độ Tổng thể (Overall Progress Bar)
        if (overallProgressBar) {
            // Tính toán tiến độ tổng thể dựa trên số chương ĐÃ HOÀN THÀNH
            const overallProgress = ((currentChapterIndex) / chapterIds.length) * 100;
            overallProgressBar.style.width = `${overallProgress}%`;
        }
        
        // 2. Tiến độ Cuộn trong chương hiện tại (Scroll Progress Bar) - Đã Tối Ưu
        if (scrollProgressBar) {
            const docElement = document.documentElement;
            
            // Tính toán tổng chiều cao có thể cuộn (scrollable height)
            const scrollHeight = docElement.scrollHeight - docElement.clientHeight;
            
            let progress = 0;
            if (scrollHeight > 0) {
                // Tính toán vị trí cuộn hiện tại / Tổng chiều cao có thể cuộn
                const scrollTop = window.pageYOffset || docElement.scrollTop;
                progress = (scrollTop / scrollHeight) * 100;
            }

            // Sử dụng Math.min/Math.max để đảm bảo giá trị nằm trong khoảng [0, 100]
            scrollProgressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        }
    }


    // 9. Gắn sự kiện cho các nút điều hướng và modal
    
    prevBtn?.addEventListener('click', () => {
        if (currentChapterIndex > 0) {
            // Luôn cuộn về đầu nội dung khi chuyển chương
            navigateToChapter(chapterIds[currentChapterIndex - 1], false); 
        }
    });

    nextBtn?.addEventListener('click', () => {
        if (currentChapterIndex < chapterIds.length - 1) {
            // Luôn cuộn về đầu nội dung khi chuyển chương
            navigateToChapter(chapterIds[currentChapterIndex + 1], false);
        }
    });

    listBtn?.addEventListener('click', () => {
        chapterModal.style.display = 'flex';
        setTimeout(() => {
            chapterModal.classList.add('modal-active');
        }, 10);
        document.body.style.overflow = 'hidden';
    });

    closeModalBtn?.addEventListener('click', () => closeModal());
    chapterModal?.addEventListener('click', (event) => {
        if (event.target === chapterModal) {
            closeModal();
        }
    });
    
    if (ttsButton) {
        ttsButton.addEventListener('click', toggleSpeech);
    }
    
    if (langSwitchButton) {
        langSwitchButton.addEventListener('click', switchLanguage);
    }
    
    modalList.addEventListener('click', (event) => {
        if (event.target.tagName === 'A' && event.target.classList.contains('modal-chapter-link')) {
            event.preventDefault();
            const chapterId = event.target.dataset.chapterId;
            // Khi chọn chương từ modal, luôn tải chương và cuộn về đầu (loadSavedScroll=false)
            navigateToChapter(chapterId, false); 
            closeModal();
        }
    });
    
    // --- Logic Tải Chương Ban Đầu (Kiểm tra trạng thái đã lưu) ---
    
    initChapterList();
    updateLangSwitchButton();
    
    const initialHash = window.location.hash.substring(1);
    
    // 1. Kiểm tra trạng thái đã lưu
    let startChapterId = null;
    let loadSavedScroll = false;
    
    try {
        const savedState = JSON.parse(localStorage.getItem(storageKey));
        if (savedState && chapterIds.includes(savedState.chapterId)) {
            startChapterId = savedState.chapterId;
            loadSavedScroll = true; // Bắt đầu từ vị trí đã lưu
        }
    } catch (e) {
        console.error('Lỗi khi kiểm tra trạng thái đã lưu:', e);
    }

    // 2. Ưu tiên Hash > Trạng thái đã lưu > Chương 1
    if (initialHash && chapterIds.includes(initialHash)) {
        startChapterId = initialHash;
        loadSavedScroll = false; // Nếu có hash, bỏ qua vị trí cuộn đã lưu, cuộn về đầu chương
    } else if (!startChapterId) {
        startChapterId = chapterIds[0]; // Mặc định là chương 1
        loadSavedScroll = false;
    }
    
    if (startChapterId) {
        navigateToChapter(startChapterId, loadSavedScroll);
    } else {
        updateSpeechButton();
    }
    
    // Gắn sự kiện lưu trạng thái khi rời trang
    window.addEventListener('beforeunload', saveState);
}

// Đảm bảo hàm này có sẵn trong phạm vi toàn cục để HTML có thể gọi
window.initializeChapterLoader = initializeChapterLoader;
