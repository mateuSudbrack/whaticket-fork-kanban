import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      `UPDATE \`Tickets\` t
       JOIN \`KanbanStages\` ks
         ON ks.\`pipelineId\` = t.\`pipelineId\`
        AND ks.\`id\` = (
          SELECT innerKs.\`id\`
          FROM \`KanbanStages\` innerKs
          WHERE innerKs.\`pipelineId\` = t.\`pipelineId\`
            AND innerKs.\`active\` = true
          ORDER BY innerKs.\`sortOrder\` ASC, innerKs.\`id\` ASC
          LIMIT 1
        )
       SET t.\`kanbanStageId\` = ks.\`id\`
       WHERE t.\`kanbanStageId\` IS NULL
         AND t.\`pipelineId\` IS NOT NULL;`
    );
  },

  down: async () => {}
};
