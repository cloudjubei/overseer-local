/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateCheckInDto = {
    /**
     * ISO8601 timestamp for new start time
     */
    start?: string;
    frequency?: UpdateCheckInDto.frequency;
    /**
     * Arbitrary metadata payload
     */
    metadata?: Record<string, any>;
};
export namespace UpdateCheckInDto {
    export enum frequency {
        DAILY = 'DAILY',
        WEEKLY = 'WEEKLY',
        BIWEEKLY = 'BIWEEKLY',
        MONTHLY = 'MONTHLY',
        OTHER = 'OTHER',
    }
}

