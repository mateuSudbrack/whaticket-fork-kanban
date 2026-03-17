import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("KanbanStages", "pipelineId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "KanbanPipelines", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("KanbanStages", "pipelineId");
  }
};
