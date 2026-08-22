import { Listing, IListing, ListingCategory } from "./listing.model";
import { getProfileByAccountId } from "../vendor/vendor.service";
import NotFoundError from "../../common/error/not-found-error";
import { newListingNearbyTemplate } from "../notification/email-templates";
import { findUsersNearLocation } from "../user/user.service";
import { sendEmail } from "../notification/notification.service";
import { QueryFilter } from "mongoose";

type CreateListingInput = {
  itemDescription: string;
  quantity: number;
  price: number | "free";
  category: ListingCategory;
  pickupByTime: Date;
  coordinates: [number, number];
};

const notifyNearbyUsers = async (listing: IListing) => {
  try {
    const nearbyUsers = await findUsersNearLocation(listing.location.coordinates, 5);
    for (const user of nearbyUsers) {
      const { subject, html } = newListingNearbyTemplate(user.name, listing.itemDescription);
      await sendEmail(user.email, subject, html);
    }
  } catch (err) {
    console.error("Failed to notify nearby users:", err);
  }
};

const createListing = async (accountId: string, input: CreateListingInput) => {
  const vendor = await getProfileByAccountId(accountId);

  const listing = await Listing.create({
    vendorId: vendor.id,
    itemDescription: input.itemDescription,
    quantity: input.quantity,
    remainingQuantity: input.quantity,
    price: input.price,
    category: input.category,
    pickupByTime: input.pickupByTime,
    location: { type: "Point", coordinates: input.coordinates },
  });
  notifyNearbyUsers(listing);
  return listing;
};

type FeedFilters = {
  lat: number;
  lng: number;
  maxDistanceKm: number;
  category?: ListingCategory;
};

const getFeed = async (filters: FeedFilters) => {
  const query: QueryFilter<IListing> = {
    state: "active",
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [filters.lng, filters.lat],
        },
        $maxDistance: filters.maxDistanceKm * 1000,
      },
    },
  };

  if (filters.category) {
    query.category = filters.category;
  }

  return Listing.find(query).sort({ pickupByTime: 1 }).populate("vendorId", "businessName address");
};

const getListingById = async (id: string) => {
  const listing = await Listing.findById(id).populate("vendorId", "businessName address");
  if (!listing) throw new NotFoundError("Listing not found");
  return listing;
};

export { createListing, getFeed, getListingById };