const siteContent = {
    dailyReadings: {
        // January
        '01-01': { source: 'Daily Reflections', text: 'A new year, a new beginning. We have the opportunity to start fresh.' },
        '01-15': { source: 'As Bill Sees It', text: 'The spiritual life is not a theory. We have to live it.' },
        '01-22': { source: 'Came to Believe', text: 'We found that God does not make too hard terms with those who seek Him.' },
        '01-28': { source: 'Twelve Steps and Twelve Traditions', text: 'The First Step is the key to liberation.' },
        // February
        '02-05': { source: 'Daily Reflections', text: 'Our real purpose is to fit ourselves to be of maximum service to God and the people about us.' },
        '02-14': { source: 'As Bill Sees It', text: 'Love and tolerance of others is our code.' },
        '02-23': { source: 'Came to Believe', text: 'The more we let God take over, the more we are free.' },
        // March
        '03-10': { source: 'Daily Reflections', text: 'We are not saints. The point is, that we are willing to grow along spiritual lines.' },
        '03-17': { source: 'As Bill Sees It', text: 'We celebrate St. Patrick\'s Day with a sense of gratitude for the spiritual awakening we have found.' },
        '03-25': { source: 'Twelve Steps and Twelve Traditions', text: 'Self-searching is the means by which we bring new vision, action, and grace to bear upon the dark and negative side of our natures.' },
        // April
        '04-01': { source: 'Daily Reflections', text: 'Progress rather than perfection is what we should strive for.' },
        '04-12': { source: 'As Bill Sees It', text: 'Each day is a day when we must carry the vision of God\'s will into all of our activities.' },
        '04-30': { source: 'Came to Believe', text: 'Our own recovery proves that the age of miracles is still with us.' },
        // Add more readings for all 12 months here...
        '08-24': { source: 'My Test Data', text: 'This is a test entry for today\'s date to ensure the feature works.' },
    },
    study: {
        title: "The Big Book",
        chapters: [
            {
                id: 'foreword',
                title: "Foreword to First Edition",
                content: [
                    "This is the Foreword to the first edition of the book 'Alcoholics Anonymous.'",
                    "We, of Alcoholics Anonymous, are more than one hundred men and women who have recovered from a seemingly hopeless state of mind and body. To show other alcoholics precisely how we have recovered is the main purpose of this book.",
                    "We think this account of our experiences will help everyone to better understand the alcoholic. Many do not comprehend that the alcoholic is a very sick person."
                ],
                qa: [
                    { q: "What is the main purpose of the book?", a: "To show other alcoholics precisely how the first one hundred members recovered." },
                    { q: "Who are the authors of the book?", a: "Over one hundred men and women in Alcoholics Anonymous who had recovered." },
                    { q: "What is a key understanding about alcoholics presented here?", a: "That the alcoholic is a very sick person, which many people do not comprehend." },
                    { q: "What hope is offered to alcoholics and their families?", a: "The hope that the experiences in the book will help them understand the alcoholic and the path to recovery." },
                    { q: "How many people had recovered when the first edition was published?", a: "A little over one hundred men and women." }
                ]
            },
            {
                id: 'doctors-opinion',
                title: "The Doctor's Opinion",
                content: [
                    "We of Alcoholics Anonymous believe that the reader will be interested in the medical estimate of the plan of recovery described in this book.",
                    "The physician who, at our request, has contributed this letter, has been kind enough to enlarge upon his original communication which appeared in the first edition of this book.",
                    "He is a doctor of medicine, specializing in the treatment of alcoholism, and was for many years the chief physician of a nationally known hospital."
                ],
                qa: [
                    { q: "Who wrote the letter that constitutes 'The Doctor's Opinion'?", a: "A doctor of medicine who specialized in alcoholism and was the chief physician of a nationally known hospital." },
                    { q: "Why was this section included in the book?", a: "To provide a medical estimate of the recovery plan described in the book, lending it credibility." },
                    { q: "What is the doctor's specialty?", a: "The treatment of alcoholism." },
                    { q: "Was this letter in the first edition?", a: "Yes, but it was enlarged for later editions at the request of A.A. members." },
                    { q: "What does this section's inclusion say about A.A.'s approach?", a: "It shows that A.A. valued medical opinion and sought to bridge the gap between medical and spiritual approaches to recovery." }
                ]
            },
            {
                id: 'bills-story',
                title: "Bill's Story",
                content: [
                    "I was born in a small Vermont town, where I lived until I was seventeen.",
                    "War fever ran high in our little town and I was caught up in it. I enlisted and was sent to an officers' training camp.",
                    "My drinking career was brief, but it was spectacular. It started with a bang and ended with a crash."
                ],
                qa: [
                    { q: "Where was Bill W. born?", a: "In a small town in Vermont." },
                    { q: "What major event was happening during Bill's youth?", a: "World War I, referred to as 'war fever'." },
                    { q: "How did Bill describe his drinking career?", a: "Brief but spectacular, starting with a bang and ending with a crash." },
                    { q: "What was his first experience with the military?", a: "He enlisted and was sent to an officers' training camp." },
                    { q: "What does the opening of his story establish?", a: "It establishes a relatable, all-American background before delving into the progression of his alcoholism." }
                ]
            }
        ]
    }
};
