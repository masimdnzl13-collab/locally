export const Roles = ['OWNER','ADMIN','STAFF'] as const; export type Role = typeof Roles[number];
export type User = { id:string; email:string; createdAt:string }; export type Restaurant = { id:string; name:string; slug:string; status:string; timezone:string; phoneNumber:string|null; address:string|null; city:string|null; state:string|null; postalCode:string|null; country:string|null; createdAt:string; updatedAt:string };
export type Membership = { userId:string; restaurantId:string; role:Role };
