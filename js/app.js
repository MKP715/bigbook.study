document.addEventListener('DOMContentLoaded', () => {
    const contentEl = document.getElementById('content');
    const navLinks = document.querySelectorAll('nav a');

    // --- Page Content & Templates ---
    const pageContent = {
        '#program': `
            <div class="page-container">
                <h2>The A.A. Program</h2>
                <p>This section details the foundational principles of Alcoholics Anonymous, known as the Three Legacies of Recovery, Unity, and Service.</p>
                <br>
                <h3>The Three Legacies</h3>
                <ul>
                    <li><strong>The Twelve Steps:</strong> The principles of personal recovery.</li>
                    <li><strong>The Twelve Traditions:</strong> The principles of group unity.</li>
                    <li><strong>The Twelve Concepts for World Service:</strong> The principles of world service.</li>
                </ul>
                <br>
                <p><em>(Detailed content for each of the steps, traditions, and concepts will be added here.)</em></p>
            </div>
        `,
        '#history': `
            <div class="page-container">
                <h2>A Brief History of A.A.</h2>
                <div class="timeline">
                    <div class="timeline-item">
                        <div class="timeline-dot"></div>
                        <span class="timeline-date">1935</span>
                        <div class="timeline-content">
                            <h3>A.A. is Founded</h3>
                            <p>Bill W. and Dr. Bob S. meet in Akron, Ohio, creating the fellowship of Alcoholics Anonymous.</p>
                        </div>
                    </div>
                    <div class="timeline-item">
                        <div class="timeline-dot"></div>
                        <span class="timeline-date">1939</span>
                        <div class="timeline-content">
                            <h3>The "Big Book" is Published</h3>
                            <p>The basic text, "Alcoholics Anonymous," is published, giving the fellowship its name.</p>
                        </div>
                    </div>
                    <div class="timeline-item">
                        <div class="timeline-dot"></div>
                        <span class="timeline-date">1953</span>
                        <div class="timeline-content">
                            <h3>"Twelve Steps and Twelve Traditions" is Published</h3>
                            <p>The "12x12" is published, offering an in-depth analysis of A.A.'s guiding principles.</p>
                        </div>
                    </div>
                    <div class="timeline-item">
                        <div class="timeline-dot"></div>
                        <span class="timeline-date">1955</span>
                        <div class="timeline-content">
                            <h3>The St. Louis Convention</h3>
                            <p>The General Service Conference declares the fellowship has come of age. The founders turn over the future of A.A. to the group conscience of its members.</p>
                        </div>
                    </div>
                </div>
            </div>
        `,
        '#culture': `
            <div class="page-container">
                <h2>A.A. Culture & Language</h2>
                <p>A guide to the language, slogans, and terms used within the fellowship.</p>
                <br>
                <h3>Common Slogans</h3>
                <p><em>(A list of common A.A. slogans like "One Day at a Time," "Easy Does It," "Keep It Simple," etc., will be added here.)</em></p>
                <br>
                <h3>Glossary of Terms</h3>
                <p><em>(A glossary of common A.A. terms and their definitions will be added here.)</em></p>
            </div>
        `,
        '#tools': `
            <div class="page-container">
                <h2>Tools for Sobriety</h2>
                <p>Practical resources for members and groups.</p>
                <br>
                <h3>12 Step Companion Guide</h3>
                <p><em>(A guide for individuals working through the twelve steps will be provided here.)</em></p>
                <br>
                <h3>Group Resources</h3>
                <p><em>(Templates and guidelines for group bylaws and effective group functions will be available here.)</em></p>
            </div>
        `,
        '#analysis': `
            <div class="page-container">
                <h2>Analysis & Search</h2>
                <p>This section will feature in-depth, topic-by-topic analysis with cross-references and a powerful search tool for all the literature on the site.</p>
                <br>
                <p><em>(Search functionality and detailed analysis content will be implemented here.)</em></p>
            </div>
        `
    };

    function renderHomePage() {
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayKey = `${month}-${day}`;
        const reading = siteContent.dailyReadings[todayKey] || {
            source: 'System',
            text: 'No reading available for today. Please check back tomorrow!'
        };
        const serenityPrayer = `
            <div class="serenity-prayer">
                <h3>The Serenity Prayer</h3>
                <p>God, grant me the serenity to accept the things I cannot change,<br>
                the courage to change the things I can,<br>
                and the wisdom to know the difference.</p>
            </div>`;
        return `
            <div class="home-container">
                <h2>Daily Reading for ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</h2>
                <div class="daily-reading">
                    <p class="quote">“${reading.text}”</p>
                    <p class="source">— ${reading.source}</p>
                </div>
                <hr class="section-divider">
                ${serenityPrayer}
            </div>`;
    }

    function renderStudyPage(path) {
        const pathParts = path.split('/');
        const chapterId = pathParts[1] || siteContent.study.chapters[0].id; // Default to the first chapter

        const chapter = siteContent.study.chapters.find(c => c.id === chapterId);
        if (!chapter) {
            contentEl.innerHTML = '<h2>Chapter Not Found</h2>';
            return;
        }

        const chapterNavHTML = `
            <nav class="study-nav">
                <h3>${siteContent.study.title}</h3>
                <ul>
                    ${siteContent.study.chapters.map(c => `
                        <li><a href="#study/${c.id}" class="${c.id === chapterId ? 'active' : ''}">${c.title}</a></li>
                    `).join('')}
                </ul>
            </nav>`;

        const contentHTML = `
            <section class="study-content">
                <h2>${chapter.title}</h2>
                <div class="page-content">
                    ${chapter.content.map(p => `<p>${p}</p>`).join('')}
                </div>
            </section>`;

        const sidePaneHTML = `
            <aside class="study-side-pane">
                <h3>Study Questions</h3>
                <div class="accordion">
                    ${chapter.qa.map((item, index) => `
                        <div class="accordion-item">
                            <button class="accordion-header" aria-expanded="false">
                                ${item.q}
                            </button>
                            <div class="accordion-content">
                                <div class="accordion-content-inner">
                                    <p>${item.a}</p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </aside>`;

        contentEl.innerHTML = `<div class="study-container">${chapterNavHTML}${contentHTML}${sidePaneHTML}</div>`;

        // Add event listeners for the new accordion elements
        attachAccordionListeners();
    }

    function attachAccordionListeners() {
        const accordionItems = document.querySelectorAll('.accordion-item');
        accordionItems.forEach(item => {
            const header = item.querySelector('.accordion-header');
            const content = item.querySelector('.accordion-content');
            header.addEventListener('click', () => {
                const isActive = item.classList.toggle('active');
                header.setAttribute('aria-expanded', isActive);
                if (isActive) {
                    content.style.maxHeight = content.scrollHeight + 'px';
                } else {
                    content.style.maxHeight = '0';
                }
            });
        });
    }

    // --- Router ---
    function router() {
        const path = window.location.hash || '#home';

        if (path === '#home') {
            contentEl.innerHTML = renderHomePage();
        } else if (path.startsWith('#study')) {
            renderStudyPage(path);
        } else {
            contentEl.innerHTML = pageContent[path] || '<h2>404 - Page Not Found</h2>';
        }

        updateActiveLink(path);
    }

    function updateActiveLink(path) {
        navLinks.forEach(link => {
            const linkHref = link.getAttribute('href');
            // Use startsWith for parent-level highlighting (e.g. #study highlights for #study/chapter)
            if (path.startsWith(linkHref) && (linkHref !== '#home' || path === '#home')) {
                 link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    // --- Event Listeners ---
    window.addEventListener('hashchange', router);
    router(); // Initial load

    // --- Dynamic Copyright Year ---
    function updateCopyright() {
        const copyrightEl = document.getElementById('copyright');
        if (copyrightEl) {
            copyrightEl.textContent = `© ${new Date().getFullYear()} bigbook.study`;
        }
    }
    updateCopyright();
});
