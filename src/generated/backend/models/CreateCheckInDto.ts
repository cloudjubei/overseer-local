/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateCheckInDto = {
    /**
     * ISO8601 timestamp when the check-in starts
     */
    start: string;
    frequency: CreateCheckInDto.frequency;
    /**
     * Arbitrary metadata payload
     */
    metadata?: Record<string, any>;
};
export namespace CreateCheckInDto {
    export enum frequency {
        DAILY = 'DAILY',
        WEEKLY = 'WEEKLY',
        BIWEEKLY = 'BIWEEKLY',
        MONTHLY = 'MONTHLY',
        OTHER = 'OTHER',
    }
}

