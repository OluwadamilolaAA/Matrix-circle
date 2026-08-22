import { ClientSession } from "mongoose";
import NotFoundError from "../../common/error/not-found-error";
import { Listing } from "../listing/listing.model";
import { Vendor } from "./vendor.model";
import { Types } from "mongoose";

type CreateVendorProfileData = {
  accountId: string;
  businessName: string;
  address: string;
  coordinates: [number, number];
};

const createVendorProfile = async (
  data: CreateVendorProfileData,
  session?: ClientSession
) => {
  return Vendor.create(
    [
      {
        accountId: data.accountId,
        businessName: data.businessName,
        address: data.address,
        location: {
          type: "Point",
          coordinates: data.coordinates,
        },
      },
    ],
    { session }
  );
};

const getProfileByAccountId = async (accountId: string) => {
  const vendor = await Vendor.findOne({ accountId });
  if (!vendor) throw new NotFoundError("Vendor profile not found");
  return vendor;
};

const getVendorDashboard = async (vendorId: string) => {
  const vendorObjectId = new Types.ObjectId(vendorId);

  const [claimStats] = await Listing.aggregate([
    { $match: { vendorId: vendorObjectId } },
    { $unwind: { path: "$claims", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: null,
        claimedItems: { $sum: { $cond: [{ $in: ["$claims.status", ["pending", "picked_up"]] }, 1, 0] } },
        pickedUpItems: { $sum: { $cond: [{ $eq: ["$claims.status", "picked_up"] }, 1, 0] } },
      },
    },
  ]);

  const discarded = await Listing.countDocuments({
    vendorId,
    state: { $in: ["expired_unclaimed", "expired_no_show"] },
  });

  const claimedItems = claimStats?.claimedItems ?? 0;
  const pickedUpItems = claimStats?.pickedUpItems ?? 0;

  return {
    claimed: claimedItems,   
    claimedItems,            
    pickedUpItems,
    discarded,
  };
};

const getVendorListings = async (vendorId: string) => {
  return Listing.find({ vendorId })
    .sort({ createdAt: -1 })
    .populate("claims.claimedBy", "name accountType");
};

export { createVendorProfile, getProfileByAccountId, getVendorDashboard, getVendorListings };