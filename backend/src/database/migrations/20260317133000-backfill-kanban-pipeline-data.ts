import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const now = new Date();
    const [pipelines]: any = await queryInterface.sequelize.query(
      'SELECT id FROM `KanbanPipelines` ORDER BY `sortOrder` ASC, id ASC LIMIT 1;'
    );

    let pipelineId = pipelines?.[0]?.id;

    if (!pipelineId) {
      await queryInterface.bulkInsert("KanbanPipelines", [
        {
          name: "Pipeline Principal",
          color: "#1976d2",
          sortOrder: 0,
          active: true,
          createdAt: now,
          updatedAt: now
        }
      ]);

      const [createdPipelines]: any = await queryInterface.sequelize.query(
        'SELECT id FROM `KanbanPipelines` ORDER BY `sortOrder` ASC, id ASC LIMIT 1;'
      );
      pipelineId = createdPipelines?.[0]?.id;
    }

    await queryInterface.sequelize.query(
      `UPDATE \`KanbanStages\`
       SET \`pipelineId\` = :pipelineId
       WHERE \`pipelineId\` IS NULL;`,
      { replacements: { pipelineId } }
    );

    await queryInterface.sequelize.query(
      `UPDATE \`Tickets\`
       SET \`pipelineId\` = (
         SELECT ks.\`pipelineId\`
         FROM \`KanbanStages\` ks
         WHERE ks.id = \`Tickets\`.\`kanbanStageId\`
         LIMIT 1
       )
       WHERE \`pipelineId\` IS NULL AND \`kanbanStageId\` IS NOT NULL;`,
      { replacements: { pipelineId } }
    );

    await queryInterface.sequelize.query(
      `UPDATE \`Tickets\`
       SET \`pipelineId\` = :pipelineId
       WHERE \`pipelineId\` IS NULL;`,
      { replacements: { pipelineId } }
    );

    await queryInterface.changeColumn("KanbanStages", "pipelineId", {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "KanbanPipelines", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });

    await queryInterface.changeColumn("Tickets", "pipelineId", {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "KanbanPipelines", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });
  },

  down: async () => {}
};
