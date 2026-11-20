import type { ReviewBundle } from '../contract/generated/review-bundle';

export interface Person {
    user_id: string;
    name: string | null;
}

/** The person's name, or their id when they have none. */
export function displayName(person: Person): string {
    return person.name ?? person.user_id;
}

/** The name of the paper's reviewer `userId`, or the id when the paper does not name them. */
export function reviewerName(reviewers: ReviewBundle['reviewers'], userId: string): string {
    const reviewer = reviewers.find((person) => person.user_id === userId);
    return reviewer ? displayName(reviewer) : userId;
}
