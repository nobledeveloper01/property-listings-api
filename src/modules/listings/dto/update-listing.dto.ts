import { PartialType } from '@nestjs/swagger';

import { CreateListingDto } from './create-listing.dto.js';

/**
 * Every field optional, same validation rules when present. `PartialType`
 * keeps the two in step; writing this out by hand is how a validation rule
 * ends up enforced on create and quietly missing on update.
 */
export class UpdateListingDto extends PartialType(CreateListingDto) {}
