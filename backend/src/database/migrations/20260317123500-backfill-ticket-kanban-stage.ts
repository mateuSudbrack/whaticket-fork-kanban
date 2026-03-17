import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const [stages] = await queryInterface.sequelize.query(
      "SELECT id, sortOrder FROM `KanbanStages`"
    ) as [{ id: number; sortOrder: number }[], unknown];

    const stageByOrder = stages.reduce<Record<number, number>>((acc, stage) => {
      acc[stage.sortOrder] = stage.id;
      return acc;
    }, {});

    if (stageByOrder[0]) {
      await queryInterface.bulkUpdate(
        "Tickets",
        { kanbanStageId: stageByOrder[0] },
        { status: "pending", kanbanStageId: null }
      );
    }

    if (stageByOrder[1]) {
      await queryInterface.bulkUpdate(
        "Tickets",
        { kanbanStageId: stageByOrder[1] },
        { status: "open", kanbanStageId: null }
      );
    }

    if (stageByOrder[2]) {
      await queryInterface.bulkUpdate(
        "Tickets",
        { kanbanStageId: stageByOrder[2] },
        { status: "closed", kanbanStageId: null }
      );
    }
  },

  down: async (_queryInterface: QueryInterface) => {}
};
