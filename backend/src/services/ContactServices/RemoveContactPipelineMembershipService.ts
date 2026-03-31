import AppError from "../../errors/AppError";
import ContactPipelineMembership from "../../models/ContactPipelineMembership";

type Request = {
  contactId: number | string;
  pipelineId: number | string;
};

const RemoveContactPipelineMembershipService = async ({
  contactId,
  pipelineId
}: Request): Promise<void> => {
  const membership = await ContactPipelineMembership.findOne({
    where: {
      contactId: Number(contactId),
      pipelineId: Number(pipelineId)
    }
  });

  if (!membership) {
    throw new AppError("ERR_NO_CONTACT_PIPELINE_MEMBERSHIP_FOUND", 404);
  }

  await membership.destroy();
};

export default RemoveContactPipelineMembershipService;
