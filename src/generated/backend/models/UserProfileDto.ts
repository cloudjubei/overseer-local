/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UserProfileDto = {
    /**
     * User id
     */
    id: string;
    /**
     * Date of birth (YYYY-MM-DD)
     */
    dob?: string;
    gender?: UserProfileDto.gender;
    /**
     * Weight in kilograms (normalized)
     */
    weight?: number;
    /**
     * Original user-entered weight string
     */
    weight_raw?: string;
    /**
     * Height in centimeters (normalized)
     */
    height?: number;
    /**
     * Original user-entered height string
     */
    height_raw?: string;
    /**
     * IANA timezone identifier
     */
    timezone: string;
};
export namespace UserProfileDto {
    export enum gender {
        MALE = 'MALE',
        FEMALE = 'FEMALE',
        OTHER = 'OTHER',
    }
}

