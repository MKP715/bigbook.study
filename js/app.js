document.addEventListener('DOMContentLoaded', () => {
    const contentEl = document.getElementById('content');
    const navLinks = document.querySelectorAll('nav a');

    // --- Page Content & Templates ---
    const pageContent = {
        '#program': `
            <div class="page-container">
                <h2>How It Works</h2>
                <p>Rarely have we seen a person fail who has thoroughly followed our path. Those who do not recover are people who cannot or will not completely give themselves to this simple program, usually men and women who are constitutionally incapable of being honest with themselves. There are such unfortunates. They are not at fault; they seem to have been born that way.</p>
                <p>Remember that you are dealing with alcohol—cunning, baffling, powerful! Without help it is too much for us. But there is One who has all power—that One is God. May you find Him now!</p>
                <p>Here are the steps we took, which are suggested as a program of recovery:</p>
                <ol class="steps-list">
                    <li>We admitted we were powerless over alcohol—that our lives had become unmanageable.</li>
                    <li>Came to believe that a Power greater than ourselves could restore us to sanity.</li>
                    <li>Made a decision to turn our will and our lives over to the care of God as we understood Him.</li>
                    <li>Made a searching and fearless moral inventory of ourselves.</li>
                    <li>Admitted to God, to ourselves, and to another human being the exact nature of our wrongs.</li>
                    <li>Were entirely ready to have God remove all these defects of character.</li>
                    <li>Humbly asked Him to remove our shortcomings.</li>
                    <li>Made a list of all persons we had harmed, and became willing to make amends to them all.</li>
                    <li>Made direct amends to such people wherever possible, except when to do so would injure them or others.</li>
                    <li>Continued to take personal inventory and when we were wrong promptly admitted it.</li>
                    <li>Sought through prayer and meditation to improve our conscious contact with God as we understood Him, praying only for knowledge of His will for us and the power to carry that out.</li>
                    <li>Having had a spiritual awakening as the result of these steps, we tried to carry this message to alcoholics, and to practice these principles in all our affairs.</li>
                </ol>
                <p>Many of us exclaimed, "What an order! I can't go through with it." Do not be discouraged. No one among us has been able to maintain anything like perfect adherence to these principles. We are not saints. The point is, that we are willing to grow along spiritual lines. The principles we have set down are guides to progress. We claim spiritual progress rather than spiritual perfection.</p>
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
                            <p>In Akron, Ohio, New York stockbroker Bill W. and Akron surgeon Dr. Bob S. meet. Both had been hopeless alcoholics and had been influenced by the Oxford Group. Their meeting marks the founding of A.A. as they immediately begin working with other alcoholics.</p>
                        </div>
                    </div>
                    <div class="timeline-item">
                        <div class="timeline-dot"></div>
                        <span class="timeline-date">1939</span>
                        <div class="timeline-content">
                            <h3>The "Big Book" is Published</h3>
                            <p>The basic text, "Alcoholics Anonymous," is published. Written by Bill W. and reviewed by early members, it explains the fellowship's philosophy and methods, centered on the Twelve Steps. The fellowship takes its name from the book.</p>
                        </div>
                    </div>
                    <div class="timeline-item">
                        <div class="timeline-dot"></div>
                        <span class="timeline-date">1941</span>
                        <div class="timeline-content">
                            <h3>Rapid Expansion</h3>
                            <p>An article in The Saturday Evening Post leads to enormous public interest. Membership jumps from 2,000 to 6,000 in one year, and the fellowship spreads rapidly across the U.S. and Canada.</p>
                        </div>
                    </div>
                    <div class="timeline-item">
                        <div class="timeline-dot"></div>
                        <span class="timeline-date">1950</span>
                        <div class="timeline-content">
                            <h3>First International Convention</h3>
                            <p>A.A. holds its first International Convention in Cleveland, Ohio. The Twelve Traditions are enthusiastically adopted for worldwide use. Co-founder Dr. Bob S. makes his last appearance and dies on November 16.</p>
                        </div>
                    </div>
                     <div class="timeline-item">
                        <div class="timeline-dot"></div>
                        <span class="timeline-date">1953</span>
                        <div class="timeline-content">
                            <h3>"Twelve Steps and Twelve Traditions" is Published</h3>
                            <p>The "12x12" is published, offering an in-depth analysis of A.A.'s guiding principles for recovery and unity.</p>
                        </div>
                    </div>
                    <div class="timeline-item">
                        <div class="timeline-dot"></div>
                        <span class="timeline-date">1955</span>
                        <div class="timeline-content">
                            <h3>A.A. Comes of Age</h3>
                            <p>At the 20th Anniversary International Convention in St. Louis, Bill W. turns over the future care and custody of A.A. to the General Service Conference and its trustees, marking the moment the fellowship truly came of age.</p>
                        </div>
                    </div>
                    <div class="timeline-item">
                        <div class="timeline-dot"></div>
                        <span class="timeline-date">1971</span>
                        <div class="timeline-content">
                            <h3>Bill W. Passes Away</h3>
                            <p>Co-founder Bill W. dies on January 24. His last words to the fellowship were, "God bless you and Alcoholics Anonymous forever." By this time, A.A. has become a truly global fellowship.</p>
                        </div>
                    </div>
                </div>
            </div>
        `,
        '#culture': `
            <div class="page-container">
                <h2>A.A. Culture & Language</h2>
                <p>The fellowship of Alcoholics Anonymous has a rich culture with its own language, customs, and traditions. Understanding these can be helpful for newcomers and those wishing to understand the program.</p>

                <h3>Common Slogans</h3>
                <p>A.A. meetings and literature are full of slogans that serve as shorthand for complex spiritual ideas. They are easy to remember and can be powerful tools in recovery.</p>
                <ul class="slogans-list">
                    <li><strong>One Day at a Time:</strong> Focus on staying sober just for today. Don't worry about yesterday or tomorrow.</li>
                    <li><strong>Easy Does It:</strong> Recovery is a process, not an event. Be patient with yourself and don't try to do too much too soon.</li>
                    <li><strong>Keep It Simple:</strong> The A.A. program is simple, but it isn't easy. Don't overcomplicate it.</li>
                    <li><strong>Let Go and Let God:</strong> Turn your will and your life over to the care of a Higher Power.</li>
                    <li><strong>Live and Let Live:</strong> Focus on your own recovery and don't judge others.</li>
                    <li><strong>First Things First:</strong> Prioritize your sobriety above all else.</li>
                    <li><strong>Keep Coming Back:</strong> It works if you work it. The fellowship is here to support you.</li>
                </ul>

                <h3>Glossary of Terms</h3>
                <dl class="glossary">
                    <dt>Big Book</dt>
                    <dd>The basic text of Alcoholics Anonymous, which gives the fellowship its name. It contains the 12 steps, personal stories of recovery, and the core philosophy of the program.</dd>
                    <dt>Sponsor</dt>
                    <dd>An experienced member of A.A. who guides a newcomer through the Twelve Steps.</dd>
                    <dt>Home Group</dt>
                    <dd>A specific A.A. group that a member attends regularly and considers their "home." It provides a stable support system.</dd>
                    <dt>Higher Power</dt>
                    <dd>A power greater than oneself. A.A. is not a religious program, so members are free to choose their own conception of a Higher Power.</dd>
                    <dt>Anonymity</dt>
                    <dd>A core principle of the fellowship, ensuring that members' identities are not disclosed at the public level. It helps create a safe environment for sharing.</dd>
                    <dt>Inventory</dt>
                    <dd>The process of "making a searching and fearless moral inventory of ourselves," as described in the Fourth Step.</dd>
                </dl>
            </div>
        `,
        '#tools': `
            <div class="page-container">
                <h2>Tools of the Program</h2>
                <p>Alcoholics Anonymous provides a number of tools to help members achieve and maintain sobriety. These are practical resources that can be used on a daily basis.</p>
                <ul class="tools-list">
                    <li>
                        <h3>The Big Book</h3>
                        <p>The primary text of A.A. It contains the Twelve Steps, personal stories of recovery, and the core principles of the program. It is a constant source of guidance and inspiration.</p>
                    </li>
                    <li>
                        <h3>Sponsorship</h3>
                        <p>A sponsor is an experienced member of A.A. who guides a newcomer through the Twelve Steps and provides support and encouragement. A sponsor is a mentor who has been through the same struggles.</p>
                    </li>
                    <li>
                        <h3>Meetings</h3>
                        <p>A.A. meetings provide a safe place for members to share their experience, strength, and hope with each other. There are different types of meetings, such as speaker meetings, discussion meetings, and Big Book studies.</p>
                    </li>
                    <li>
                        <h3>The Twelve Steps</h3>
                        <p>The core of the A.A. program. They are a set of spiritual principles which, when practiced as a way of life, can expel the obsession to drink and enable the sufferer to become happily and usefully whole.</p>
                    </li>
                    <li>
                        <h3>The Telephone</h3>
                        <p>Members are encouraged to use the telephone to stay in touch with other members, especially when they are struggling. A quick call to a sponsor or another A.A. friend can make all the difference.</p>
                    </li>
                    <li>
                        <h3>Service</h3>
                        <p>Giving back to the fellowship is a key part of recovery. This can range from making coffee at a meeting to sponsoring newcomers or serving on committees. Service helps to keep the member sober and ensures that the fellowship is there for the next person who needs it.</p>
                    </li>
                </ul>
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
