/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CheckInDto = {
    /**
     * Check-in id (UUID)
     */
    id: string;
    /**
     * Owner user id
     */
    userId: string;
    /**
     * ISO8601 timestamp when the check-in starts
     */
    start: string;
    frequency: CheckInDto.frequency;
    metadata?: Record<string, any>;
    /**
     * ISO8601 timestamp when record was created
     */
    createdAt: string;
    /**
     * ISO8601 timestamp when record was last updated
     */
    updatedAt: string;
};
export namespace CheckInDto {
    export enum frequency {
        DAILY = 'DAILY',
        WEEKLY = 'WEEKLY',
        BIWEEKLY = 'BIWEEKLY',
        MONTHLY = 'MONTHLY',
        OTHER = 'OTHER',
    }
}

