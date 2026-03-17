import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("ContactCustomFields", "fieldDefinitionId", {
      type: DataTypes.INTEGER,
      references: { model: "ContactFieldDefinitions", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      allowNull: true
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn(
      "ContactCustomFields",
      "fieldDefinitionId"
    );
  }
};
