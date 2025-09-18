/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateProfileDto = {
    /**
     * Date of birth (YYYY-MM-DD)
     */
    dob?: string;
    gender?: CreateProfileDto.gender;
    /**
     * Raw user-entered weight (e.g., "82 kg", "180 lb", "11st 4lb")
     */
    weight_raw?: string;
    /**
     * Raw user-entered height (e.g., "175 cm", "1.75 m", "5'11"", "71 in")
     */
    height_raw?: string;
    /**
     * IANA timezone identifier
     */
    timezone: string;
};
export namespace CreateProfileDto {
    export enum gender {
        MALE = 'MALE',
        FEMALE = 'FEMALE',
        OTHER = 'OTHER',
    }
}

