import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Flows", "layout", {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {}
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Flows", "layout");
  }
};
